FROM node:18-alpine AS builder

# Install git for version generation
RUN apk add --no-cache git

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code and .git for version info
COPY . .

# Build argument for API URL
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration template
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Railway sets PORT environment variable
ENV PORT=80

EXPOSE $PORT

# nginx:alpine image automatically processes templates in /etc/nginx/templates/
CMD ["nginx", "-g", "daemon off;"]
