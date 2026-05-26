# Use lightweight Node.js 20 base image
FROM node:20-alpine

# Set working directory inside container
WORKDIR /app

# Copy package.json and package-lock.json first to utilize Docker build cache
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy the rest of the backend source code
COPY . .

# Expose backend API port (matching GEMINI.md standard)
EXPOSE 9999

# Run the server directly with Node.js (Docker handles restart policy)
CMD ["node", "server.js"]
