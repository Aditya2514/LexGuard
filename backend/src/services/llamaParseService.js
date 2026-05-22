const FormData = require('form-data');
const fs = require('fs');

/**
 * Uploads a document to LlamaParse, waits for it to process, and returns the markdown text.
 * Requires LLAMA_CLOUD_API_KEY.
 */
async function parseWithLlama(filePath) {
    const apiKey = process.env.LLAMA_CLOUD_API_KEY;
    if (!apiKey) {
        throw new Error('LLAMA_CLOUD_API_KEY is not defined.');
    }

    // 1. Upload File
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));

    const uploadRes = await fetch('https://api.cloud.llamaindex.ai/api/parsing/upload', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`
        },
        body: formData
    });

    if (!uploadRes.ok) {
        throw new Error(`LlamaParse Upload Error: ${await uploadRes.text()}`);
    }

    const { id } = await uploadRes.json();
    if (!id) throw new Error('No job ID returned from LlamaParse');

    // 2. Poll for completion
    let status = 'PENDING';
    for (let i = 0; i < 30; i++) { // wait up to 60 seconds
        await new Promise(r => setTimeout(r, 2000));
        
        const statusRes = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${id}`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        
        if (!statusRes.ok) continue;
        
        const statusData = await statusRes.json();
        status = statusData.status;

        if (status === 'SUCCESS') {
            break;
        } else if (status === 'ERROR') {
            throw new Error('LlamaParse job failed');
        }
    }

    if (status !== 'SUCCESS') {
        throw new Error('LlamaParse polling timed out');
    }

    // 3. Get results
    const resultRes = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${id}/result/markdown`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!resultRes.ok) {
        throw new Error(`Failed to fetch LlamaParse result: ${await resultRes.text()}`);
    }

    const resultData = await resultRes.json();
    return resultData.markdown || '';
}

module.exports = { parseWithLlama };
