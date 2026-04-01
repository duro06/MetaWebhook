FROM node:18-alpine

WORKDIR /usr/src/app

# Install dependencies dan nodemon secara global
RUN npm init -y && npm install express axios socket.io && npm install -g nodemon

COPY . .

EXPOSE 3000

# Gunakan nodemon untuk menjalankan aplikasi
CMD [ "nodemon", "--poll", "app.js" ]