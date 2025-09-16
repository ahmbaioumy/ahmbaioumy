FROM node:20-alpine
WORKDIR /app
COPY frontend/package.json frontend/tsconfig.json frontend/vite.config.ts /app/
COPY frontend/src /app/src
COPY frontend/index.html /app/index.html
RUN npm install && npm run build || true
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

