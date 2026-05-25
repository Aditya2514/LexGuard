const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const Contract = require('../models/Contract');
const Clause = require('../models/Clause');
const { extractText } = require('../services/parserService');
const { splitClauses } = require('../services/clauseSplitter');
const { classifyClausesForContract } = require('../services/agent1ClauseExtractor');
const { analyseRisksForContract } = require('../services/agent2RiskAnalyst');
const { generateUserAdvocateForContract } = require('../services/agent3UserAdvocate');
const { runComplianceCheckForContract } = require('../services/agent4ComplianceChecker');
const { computeRiskSummaryForContract } = require('../services/riskSummaryService');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { CONTRACT_CATEGORIES, MAX_FILE_SIZE_BYTES } = require('../config/constants');
const jobQueueService = require('../services/jobQueueService');
const QueueJob = require('../models/QueueJob');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { getFileStream } = require('../services/gridFsStorage');
const mongoose = require('mongoose');

// ── Multer Setup ────────────────────────────────────────────────────────────

const fileFilter = (_req, file, cb) => {
  const allowedMimes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  const allowedExts = ['.pdf', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Invalid file type. Only PDF and DOCX are allowed.'));
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

// ── Utility ─────────────────────────────────────────────────────────────────



// ── POST /api/contracts ─────────────────────────────────────────────────────
// Upload a contract file, extract text, split into clauses, store in DB.

router.use(protect); // Protect all contract routes

router.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ApiError(400, 'No file uploaded. Please attach a PDF or DOCX file as the "file" field.');
    }

    if (req.user.usedThisMonth >= req.user.monthlyQuota) {
      // With GridFS, we would normally delete via gridFS bucket, but for now we skip complex cleanup
      throw new ApiError(429, 'Monthly contract quota exceeded. Please upgrade your plan.');
    }

    const { contractCategory, parentContractId } = req.body;

    if (!contractCategory || !CONTRACT_CATEGORIES.includes(contractCategory)) {
      throw new ApiError(
        400,
        `Invalid or missing contractCategory. Allowed values: ${CONTRACT_CATEGORIES.join(', ')}.`
      );
    }

    let contract = null;

    try {
      // 0. Manual GridFS Upload to bypass outdated multer-gridfs-storage library
      const gfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });
      const { Readable } = require('stream');
      const crypto = require('crypto');
      const filename = crypto.randomBytes(16).toString('hex') + path.extname(req.file.originalname);
      
      const uploadStream = gfsBucket.openUploadStream(filename, {
        contentType: req.file.mimetype,
      });
      
      Readable.from(req.file.buffer).pipe(uploadStream);
      
      await new Promise((resolve, reject) => {
        uploadStream.on('finish', resolve);
        uploadStream.on('error', reject);
      });

      req.file.id = uploadStream.id;
      req.file.filename = filename;

      // 1. Extract and clean text from the uploaded file
      const cleanedText = await extractText(req.file.id, req.file.originalname);

      // 2. Split cleaned text into clause segments (heuristic, no AI)
      const clauseSegments = splitClauses(cleanedText);

      if (clauseSegments.length === 0) {
        throw new ApiError(
          422,
          'No clauses could be extracted. The document may be too short or improperly formatted.'
        );
      }

      // 3. Persist Contract document
      contract = await Contract.create({
        userId: req.user._id,
        parentContractId: parentContractId || null,
        originalFileName: req.file.originalname,
        fileName: req.file.filename,
        filePath: req.file.filename,
        fileSize: req.file.size,
        contractCategory,
        rawText: cleanedText,
        totalClauses: clauseSegments.length,
        status: 'processing',
      });
      
      // Increment user quota
      req.user.usedThisMonth += 1;
      await req.user.save();

      // 4. Bulk-insert all Clause documents
      const clauseDocs = clauseSegments.map((seg) => ({
        contractId: contract._id,
        segmentIndex: seg.segmentIndex,
        rawText: seg.rawText,
      }));
      await Clause.insertMany(clauseDocs);

      // 5. Remove temp file (no longer needed after text extraction)
      // Skipped: We are using GridFS so we do not delete from the local filesystem

      // 6. Enqueue/Process contract job
      if (req.query.sync === 'true') {
        console.log(`⚡ Running synchronous analysis for contract: ${contract._id}...`);
        await jobQueueService.processContractJob(contract._id);
        
        // Fetch fully updated contract object
        const updatedContract = await Contract.findById(contract._id);

        return res.status(201).json(
          new ApiResponse(
            201,
            {
              contractId: updatedContract._id,
              fileName: updatedContract.originalFileName,
              clauseCount: updatedContract.totalClauses,
              status: updatedContract.status,
              overallRiskLevel: updatedContract.overallRiskLevel,
            },
            'Contract uploaded and analyzed synchronously successfully.'
          )
        );
      }

      await jobQueueService.enqueueJob(contract._id);

      return res.status(202).json(
        new ApiResponse(
          202,
          {
            contractId: contract._id,
            fileName: contract.originalFileName,
            clauseCount: contract.totalClauses,
            status: 'queued',
            overallRiskLevel: null,
          },
          'Contract uploaded successfully. AI analysis is running in the background.'
        )
      );
    } catch (err) {
      // Mark contract as failed if it was partially created
      if (contract?._id) {
        await Contract.findByIdAndUpdate(contract._id, { status: 'failed' }).catch(() => {});
      }
      throw err;
    }
  })
);

// ── GET /api/contracts ──────────────────────────────────────────────────────
// List all contracts (summary fields only).

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const contracts = await Contract.find({ userId: req.user._id })
      .select('_id originalFileName contractCategory status totalClauses overallRiskLevel uploadedAt')
      .sort({ uploadedAt: -1 });

    return res.status(200).json(
      new ApiResponse(200, contracts, 'Contracts fetched successfully.')
    );
  })
);

// ── GET /api/contracts/:id/stream ──────────────────────────────────────────────
// Server-Sent Events stream for real-time AI processing updates.

router.get(
  '/:id/stream',
  asyncHandler(async (req, res) => {
    const contract = await Contract.findOne({ _id: req.params.id, userId: req.user._id });
    if (!contract) throw new ApiError(404, 'Contract not found.');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    res.write(`data: ${JSON.stringify({ status: contract.status, message: 'Connected' })}\n\n`);

    // Initialize change stream on QueueJob collection
    const changeStream = QueueJob.watch([], { fullDocument: 'updateLookup' });

    changeStream.on('change', async (change) => {
      if (!change.fullDocument) return;
      if (change.fullDocument.contractId.toString() !== req.params.id) return;

      const qJob = change.fullDocument;
      let cStatus = qJob.status === 'completed' ? 'done' : qJob.status;
      
      const payload = {
        status: cStatus,
        overallRiskLevel: null,
        progress: qJob.progress,
        step: qJob.step,
      };

      if (cStatus === 'done' || cStatus === 'failed') {
        const updatedContract = await Contract.findById(req.params.id);
        payload.status = updatedContract.status;
        payload.overallRiskLevel = updatedContract.overallRiskLevel;
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
        changeStream.close();
        res.end();
      } else {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
    });

    req.on('close', () => {
      changeStream.close();
    });
  })
);

// ── GET /api/contracts/:id ──────────────────────────────────────────────────
// Fetch full contract object (without clauses).


router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const contract = await Contract.findOne({ _id: req.params.id, userId: req.user._id });
    if (!contract) throw new ApiError(404, 'Contract not found.');

    // Fetch background job details
    const queueJob = await QueueJob.findOne({ contractId: req.params.id })
      .select('status progress step error');

    const responseData = {
      ...contract.toObject(),
      jobProgress: queueJob ? {
        status: queueJob.status,
        progress: queueJob.progress,
        step: queueJob.step,
        error: queueJob.error,
      } : null,
    };

    return res.status(200).json(
      new ApiResponse(200, responseData, 'Contract fetched successfully.')
    );
  })
);

// ── GET /api/contracts/:id/clauses ──────────────────────────────────────────
// Paginated list of clauses for a contract.

router.get(
  '/:id/clauses',
  asyncHandler(async (req, res) => {
    const contract = await Contract.findOne({ _id: req.params.id, userId: req.user._id }).select('_id');
    if (!contract) throw new ApiError(404, 'Contract not found.');

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [clauses, total] = await Promise.all([
      Clause.find({ contractId: req.params.id })
        .select('_id segmentIndex rawText clause_type risk_level risk_score confidence_score')
        .sort({ segmentIndex: 1 })
        .skip(skip)
        .limit(limit),
      Clause.countDocuments({ contractId: req.params.id }),
    ]);

    return res.status(200).json(
      new ApiResponse(200, {
        clauses,
        total,
        page,
        pages: Math.ceil(total / limit),
      }, 'Clauses fetched successfully.')
    );
  })
);

// ── GET /api/contracts/:id/clauses-detailed ─────────────────────────────────
// Paginated list of clauses with full detail (for frontend contract detail page).

router.get(
  '/:id/clauses-detailed',
  asyncHandler(async (req, res) => {
    const contract = await Contract.findOne({ _id: req.params.id, userId: req.user._id }).select('_id');
    if (!contract) throw new ApiError(404, 'Contract not found.');

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [clauses, total] = await Promise.all([
      Clause.find({ contractId: req.params.id })
        .select(
          '_id segmentIndex rawText ' +
          'clause_type category_tags ' +
          'risk_level risk_score confidence_score risk_reasons possible_law_references ' +
          'plain_language_explanation worst_case_scenario negotiation_tip ' +
          'compliance_risk_level potential_issue_areas human_review_strongly_recommended explanatory_note'
        )
        .sort({ segmentIndex: 1 })
        .skip(skip)
        .limit(limit),
      Clause.countDocuments({ contractId: req.params.id }),
    ]);

    return res.status(200).json(
      new ApiResponse(200, {
        clauses,
        total,
        page,
        pages: Math.ceil(total / limit),
      }, 'Detailed clauses fetched successfully.')
    );
  })
);

// ── GET /api/contracts/:id/risk-summary ─────────────────────────────────────
// Aggregated risk breakdown for a contract.

router.get(
  '/:id/risk-summary',
  asyncHandler(async (req, res) => {
    const contract = await Contract.findOne({ _id: req.params.id, userId: req.user._id }).select('_id');
    if (!contract) throw new ApiError(404, 'Contract not found.');

    const summary = await computeRiskSummaryForContract(req.params.id);
    if (!summary) throw new ApiError(404, 'Summary could not be generated.');

    return res.status(200).json(
      new ApiResponse(200, summary, 'Risk summary generated.')
    );
  })
);

// ── POST /api/contracts/:id/chat ───────────────────────────────────────────────
// Ask Agent 5 questions about a specific contract.

router.post(
  '/:id/chat',
  asyncHandler(async (req, res) => {
    const { message } = req.body;
    if (!message) throw new ApiError(400, 'Chat message is required.');

    const contract = await Contract.findOne({ _id: req.params.id, userId: req.user._id });
    if (!contract) throw new ApiError(404, 'Contract not found.');

    const { chatWithContract } = require('../services/agent5Chat');
    const reply = await chatWithContract(req.params.id, message);

    return res.status(200).json(
      new ApiResponse(200, { reply }, 'Chat response generated.')
    );
  })
);

// ── GET /api/contracts/:id/export-redline ──────────────────────────────────
// Export automated negotiation redlines as a DOCX file.
const { exportRedlineToDocx } = require('../controllers/exportController');
router.get('/:id/export-redline', exportRedlineToDocx);

// ── DELETE /api/contracts/:id ───────────────────────────────────────────────
// Delete a contract and all its clauses.

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const contract = await Contract.findOne({ _id: req.params.id, userId: req.user._id });
    if (!contract) throw new ApiError(404, 'Contract not found.');

    await Clause.deleteMany({ contractId: req.params.id });
    await Contract.findByIdAndDelete(req.params.id);

    return res.status(200).json(
      new ApiResponse(200, { deleted: true }, 'Contract and all associated clauses deleted.')
    );
  })
);

module.exports = router;
