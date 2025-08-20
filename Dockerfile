# 1. Start with the official Bun image (Alpine is lightweight)
FROM oven/bun:1-alpine

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Copy dependency files first to leverage Docker's cache
#    This step only re-runs if these files change.
COPY package.json bun.lock ./

# 4. Install dependencies (production only for smaller image size)
RUN bun install --production

# 5. Copy the rest of your application code
COPY . .

# 6. Expose the port your app runs on (e.g., 3000)
EXPOSE 3001

# 7. The command to run your application
CMD ["bun", "run", "start"]