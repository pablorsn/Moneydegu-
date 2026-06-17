# Usar imagem leve do Node.js
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências (incluindo dev se houver)
RUN npm install

# Copiar todo o código fonte
COPY . .

# Imagem final de produção
FROM node:20-alpine

WORKDIR /usr/src/app

# Copiar arquivos necessários do builder
COPY package*.json ./
RUN npm prune --production

COPY --from=builder /usr/src/app/public ./public
COPY --from=builder /usr/src/app/server.js ./server.js
COPY --from=builder /usr/src/app/db.js ./db.js

# Expor a porta que a aplicação rodará
EXPOSE 3001

# Variáveis de ambiente padrão
ENV PORT=3001
ENV NODE_ENV=production

# Comando para rodar a aplicação
CMD ["npm", "start"]
