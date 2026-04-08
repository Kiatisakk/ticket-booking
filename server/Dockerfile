FROM node:20-alpine
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy application files
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Expose port
EXPOSE 4000

# Start the server
CMD ["node", "index.js"]