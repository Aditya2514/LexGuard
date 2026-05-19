# Use official Node.js Alpine image for a small footprint
FROM node:20-alpine

# Install system dependencies for OCR fallback pipeline
# tesseract-ocr: Optical character recognition for scanned PDFs
# poppler-utils: pdftoppm to convert PDF pages to images for OCR
# tessdata: English language training data for Tesseract
RUN apk add --no-cache tesseract-ocr poppler-utils

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

