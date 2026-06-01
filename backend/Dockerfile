# Use Debian slim image to resolve glibc dependency errors with onnxruntime-node
FROM node:20-slim

# Install system dependencies for OCR fallback pipeline
# tesseract-ocr: Optical character recognition for scanned PDFs
# poppler-utils: pdftoppm to convert PDF pages to images for OCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

# Install dependencies (production only for smaller image)
RUN npm ci --only=production

# Copy the rest of the application code
COPY . .

# Hugging Face Spaces dynamically assign PORT=7860
EXPOSE 7860

# Start the Node.js server
CMD ["npm", "start"]

