FROM node:20-alpine

# Install standard alpine system dependencies for Prisma
RUN apk add --no-cache openssl direnv libc6-compat

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Generate Prisma Client binary inside the container environment
RUN npx prisma generate

EXPOSE 5000
CMD ["npm", "run", "dev"]