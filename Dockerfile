# Gunakan image Node.js versi ringan
FROM node:18-alpine

# Tentukan direktori kerja di dalam container
WORKDIR /usr/src/app

# Copy package.json dan install dependencies
COPY package*.json ./
RUN npm install --production

# Copy semua file kode ke dalam container
COPY . .

# Expose port yang digunakan
EXPOSE 3000

# Jalankan aplikasi
CMD [ "node", "app.js" ]