const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');
const Contract = require('../models/Contract');
const Clause = require('../models/Clause');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Generates a Redlined .docx file containing high/critical risk clauses and their advocate rewrites.
 */
const exportRedlineToDocx = asyncHandler(async (req, res) => {
    // 1. Fetch Contract & Clauses
    const contract = await Contract.findOne({ _id: req.params.id, userId: req.user._id });
    if (!contract) {
        throw new ApiError(404, 'Contract not found or access denied.');
    }

    const clauses = await Clause.find({ contractId: contract._id })
        .sort({ order: 1 })
        .lean();

    if (!clauses || clauses.length === 0) {
        throw new ApiError(400, 'No clauses found for this contract.');
    }

    // 2. Filter clauses that actually need negotiation (High/Critical)
    const riskyClauses = clauses.filter(c => 
        (c.risk_level === 'high' || c.risk_level === 'critical') && 
        c.advocate_rewrite
    );

    // 3. Build DOCX Document
    const docChildren = [
        new Paragraph({
            text: "LexGuard Contract Negotiation Redlines",
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
        }),
        new Paragraph({
            text: `Contract: ${contract.title || 'Untitled Document'}`,
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
        }),
        new Paragraph({
            text: `Generated on: ${new Date().toLocaleDateString()}`,
            spacing: { after: 400 }
        })
    ];

    if (riskyClauses.length === 0) {
        docChildren.push(new Paragraph({
            text: "Great news! LexGuard found no critical or high-risk clauses requiring immediate negotiation.",
        }));
    } else {
        docChildren.push(new Paragraph({
            text: "The following clauses have been flagged as predatory or high-risk. We have provided legally-sound redline rewrites below to propose to the counterparty.",
            spacing: { after: 400 }
        }));

        riskyClauses.forEach((clause, index) => {
            // Clause Title / Type
            docChildren.push(new Paragraph({
                text: `${index + 1}. ${clause.clause_type.replace(/_/g, ' ').toUpperCase()}`,
                heading: HeadingLevel.HEADING_3,
                spacing: { before: 400, after: 100 }
            }));

            // Risk Level & Reasoning
            docChildren.push(new Paragraph({
                children: [
                    new TextRun({ text: "Risk Level: ", bold: true }),
                    new TextRun({ 
                        text: clause.risk_level.toUpperCase(), 
                        color: clause.risk_level === 'critical' ? "FF0000" : "FFA500",
                        bold: true 
                    })
                ],
                spacing: { after: 100 }
            }));

            docChildren.push(new Paragraph({
                children: [
                    new TextRun({ text: "Why it's dangerous: ", bold: true }),
                    new TextRun({ text: clause.risk_reasons?.join(' ') || 'Standard review flagged.' })
                ],
                spacing: { after: 200 }
            }));

            // Original Text
            docChildren.push(new Paragraph({
                children: [
                    new TextRun({ text: "Original Text (To be replaced):", bold: true, strike: true })
                ],
                spacing: { after: 100 }
            }));
            docChildren.push(new Paragraph({
                text: clause.text || clause.rawText || "N/A",
                strike: true,
                color: "888888",
                spacing: { after: 200 }
            }));

            // Proposed Redline
            docChildren.push(new Paragraph({
                children: [
                    new TextRun({ text: "Proposed Safe Rewrite (Insert):", bold: true, color: "008000" })
                ],
                spacing: { after: 100 }
            }));
            docChildren.push(new Paragraph({
                text: clause.advocate_rewrite,
                color: "008000",
                spacing: { after: 200 }
            }));
        });
    }

    const doc = new Document({
        sections: [{
            properties: {},
            children: docChildren
        }]
    });

    // 4. Generate DOCX Buffer
    const buffer = await Packer.toBuffer(doc);

    // 5. Send as a File Download
    res.setHeader('Content-Disposition', `attachment; filename="LexGuard_Redlines_${contract._id}.docx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    return res.status(200).send(buffer);
});

module.exports = {
    exportRedlineToDocx
};
