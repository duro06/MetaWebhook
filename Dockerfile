FROM node:18-alpine

WORKDIR /usr/src/app

# Gabungkan instalasi library dan nodemon
RUN npm init -y && \
  npm install express axios socket.io nodemon

COPY . .

EXPOSE 3000

# Gunakan nodemon untuk menjalankan aplikasi
CMD [ "nodemon",  "app.js" ]