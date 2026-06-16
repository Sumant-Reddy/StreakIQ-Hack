FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# Remove the custom nginx line if you don't have an nginx.conf file created locally yet
COPY nginx.conf /etc/nginx/conf.d/default.conf 
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]