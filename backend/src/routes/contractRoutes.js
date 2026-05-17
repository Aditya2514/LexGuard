const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const Contract = require('../models/Contract');
const Clause = require('../models/Clause');
const { extractText } = require('../services/parserService');
const { splitClauses } = require('../services/clauseSplitter');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { CONTRACT_CATEGORIES, MAX_FILE_SIZE_BYTES } = require('../config/constants');

// ── Multer Setup ────────────────────────────────────────────────────────────

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});

const fileFilter = (_req, file, cb) => {
  const allowedMimes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  const allowedExts = ['.pdf', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    // Must pass a plain Error to multer (not ApiError) so multer forwards it correctly
    const err = new Error('Only PDF and DOCX files are allowed.');
    err.statusCode = 400;
    cb(err, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

// ── Utility ─────────────────────────────────────────────────────────────────

/** Silently deletes a temp file after processing. */
const deleteTempFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.warn(`⚠️  Could not delete temp file: ${filePath}`);
    }
  }
};

// ── POST /api/contracts ─────────────────────────────────────────────────────
// Upload a contract file, extract text, split into clauses, store in DB.

router.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ApiError(400, 'No file uploaded. Please attach a PDF or DOCX file as the "file" field.');
    }

    const { contractCategory } = req.body;

    if (!contractCategory || !CONTRACT_CATEGORIES.includes(contractCategory)) {
      deleteTempFile(req.file.path);
      throw new ApiError(
        400,
        `Invalid or missing contractCategory. Allowed values: ${CONTRACT_CATEGORIES.join(', ')}.`
      );
    }

    let contract = null;

    try {
      // 1. Extract and clean text from the uploaded file
      const cleanedText = await extractText(req.file.path, req.file.originalname);

      // 2. Split cleaned text into clause segments (heuristic, no AI)
      const clauseSegments = splitClauses(cleanedText);

      if (clauseSegments.length === 0) {
        deleteTempFile(req.file.path);
        throw new ApiError(
          422,
          'No clauses could be extracted. The document may be too short or improperly formatted.'
        );
      }

      // 3. Persist Contract document
      contract = await Contract.create({
        originalFileName: req.file.originalname,
        contractCategory,
        rawText: cleanedText,
        totalClauses: clauseSegments.length,
        status: 'processing',
      });

      // 4. Bulk-insert all Clause documents
      const clauseDocs = clauseSegments.map((seg) => ({
        contractId: contract._id,
        segmentIndex: seg.segmentIndex,
        rawText: seg.rawText,
      }));
      await Clause.insertMany(clauseDocs);

      // 5. Mark contract as done
      contract.status = 'done';
      await contract.save();

      // 6. Remove temp file
      deleteTempFile(req.file.path);

      return res.status(201).json(
        new ApiResponse(
          201,
          {
            contractId: contract._id,
            fileName: contract.originalFileName,
            clauseCount: clauseSegments.length,
            status: contract.status,
          },
          'Contract uploaded and processed successfully.'
        )
      );
    } catch (err) {
      // Mark contract as failed if it was partially created
      if (contract?._id) {
        await Contract.findByIdAndUpdate(contract._id, { status: 'failed' }).catch(() => {});
      }
      deleteTempFile(req.file?.path);
      throw err;
    }
  })
);

// ── GET /api/contracts ──────────────────────────────────────────────────────
// List all contracts (summary fields only).

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const contracts = await Contract.find()
      .select('_id originalFileName contractCategory status totalClauses uploadedAt')
      .sort({ uploadedAt: -1 });

    return res.status(200).json(
      new ApiResponse(200, contracts, 'Contracts fetched successfully.')
    );
  })
);

// ── GET /api/contracts/:id ──────────────────────────────────────────────────
// Fetch full contract object (without clauses).

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const contract = await Contract.findById(req.params.id);
    if (!contract) throw new ApiError(404, 'Contract not found.');

    return res.status(200).json(
      new ApiResponse(200, contract, 'Contract fetched successfully.')
    );
  })
);

// ── GET /api/contracts/:id/clauses ──────────────────────────────────────────
// Paginated list of clauses for a contract.

router.get(
  '/:id/clauses',
  asyncHandler(async (req, res) => {
    const contract = await Contract.findById(req.params.id).select('_id');
    if (!contract) throw new ApiError(404, 'Contract not found.');

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [clauses, total] = await Promise.all([
      Clause.find({ contractId: req.params.id })
        .select('_id segmentIndex rawText clause_type risk_level risk_score')
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

// ── DELETE /api/contracts/:id ───────────────────────────────────────────────
// Delete a contract and all its clauses.

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const contract = await Contract.findById(req.params.id);
    if (!contract) throw new ApiError(404, 'Contract not found.');

    await Clause.deleteMany({ contractId: req.params.id });
    await Contract.findByIdAndDelete(req.params.id);

    return res.status(200).json(
      new ApiResponse(200, { deleted: true }, 'Contract and all associated clauses deleted.')
    );
  })
);

module.exports = router;
