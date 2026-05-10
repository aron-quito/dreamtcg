FROM node:20-alpine

WORKDIR /app

# Instalar dependencias primero para aprovechar el cache de capas
COPY package*.json ./
RUN npm install

# Copiar el resto del código
COPY . .

# El puerto que definimos en package.json (3000)
EXPOSE 3000

# Comando para desarrollo con Vite expuesto a la red
CMD ["npm", "run", "dev"]
