FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY server.mjs ./
COPY public ./public
COPY data ./data
ENV NODE_ENV=production
ENV PORT=4173
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://127.0.0.1:4173/api/health || exit 1
CMD ["node","server.mjs"]