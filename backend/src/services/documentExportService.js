const { Document, Packer, Paragraph, TextRun, AlignmentType } = require('docx');
const mongoose = require('mongoose');
const Clause = require('../models/Clause');
const Contract = require('../models/Contract');
const { Types } = mongoose;

/**
 * Builds a DOCX file from the AST of the contract, replacing flagged clauses
 * with their rewritten text, and showing a redline effect (strikethrough old, highlight new).
 */
async function exportCleanedContract(contractId) {
    const clauses = await Clause.find({ contractId: new Types.ObjectId(contractId) })
        .sort({ segmentIndex: 1 })
        .lean();

    if (!clauses || clauses.length === 0) {
        throw new Error('No clauses found for contract export.');
    }

    const docChildren = [];

    // Title
    docChildren.push(
        new Paragraph({
            text: "LEXGUARD: CLEANED & REDLINED CONTRACT",
            heading: 'Heading1',
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
        })
    );

    // Build paragraphs
    for (const clause of clauses) {
        const textRuns = [];

        if (clause.rewritten_text) {
            // It was rewritten! Show redline.
            
            // 1. Strike through the old predatory text (Red)
            textRuns.push(
                new TextRun({
                    text: clause.rawText,
                    strike: true,
                    color: "FF0000",
                })
            );

            // Add spacing between old and new
            textRuns.push(new TextRun({ text: "  ", break: 1 }));

            // 2. Add the new fair text (Green / Bold)
            textRuns.push(
                new TextRun({
                    text: clause.rewritten_text,
                    color: "008000",
                    bold: true
                })
            );
        } else {
            // Unchanged safe text
            textRuns.push(
                new TextRun({
                    text: clause.rawText
                })
            );
        }

        docChildren.push(
            new Paragraph({
                children: textRuns,
                spacing: { after: 200 }
            })
        );
    }

    const doc = new Document({
        creator: "LexGuard AI",
        title: "Cleaned Contract",
        description: "Auto-Redlined by Agent 8",
        sections: [
            {
                properties: {},
                children: docChildren,
            },
        ],
    });

    // Create the buffer
    const buffer = await Packer.toBuffer(doc);
    return buffer;
}

module.exports = {
    exportCleanedContract
};
