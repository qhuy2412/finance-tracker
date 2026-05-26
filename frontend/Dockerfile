# Stage 1: Build the React application
FROM node:20-alpine AS build

# Set working directory inside container
WORKDIR /app

# Copy package files first to utilize Docker build cache
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the frontend source code
COPY . .

# Inject build argument for API URL so Vite can bake it into static files
ARG VITE_API_URL=http://localhost:9999
ENV VITE_API_URL=$VITE_API_URL

# Build the production bundle (creates 'dist' folder)
RUN npm run build

# Stage 2: Serve the static files with Nginx
FROM nginx:stable-alpine

# Copy built static files from Stage 1 to Nginx default HTML folder
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration to support SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 for traffic
EXPOSE 80

# Start Nginx in the foreground so the container stays active
CMD ["nginx", "-g", "daemon off;"]
