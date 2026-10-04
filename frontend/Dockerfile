FROM node:20-alpine

WORKDIR /app

# Copiar definiciones de dependencias
COPY package.json ./

# Instalar dependencias del proyecto
RUN npm install

# Copiar el resto del código
COPY . .

# Exponer el puerto por defecto de Vite
EXPOSE 5173

# Ejecutar el servidor de desarrollo de Vite con acceso externo
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
