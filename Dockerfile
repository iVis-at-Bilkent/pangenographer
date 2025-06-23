FROM node:14.20.1 AS runtime
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 4200
CMD ["npm", "run", "ng", "serve", "--host", "0.0.0.0", "--port", "4200"]