FROM node:14.20.1 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm cache clean --force && \
    rm -rf dist && \
    npm run build-prod

FROM node:14.20.1 AS runtime
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/package*.json ./
RUN npm install
EXPOSE 5200
CMD ["npm", "run", "start"]