FROM node:lts-alpine

# Create directories
WORKDIR /tmp/app
RUN mkdir -p /usr/src/dropins

# Copy app to temp location
COPY package.json ./
COPY *.js ./

# Restore packages
RUN npm install

# Set correct workdir for startup
WORKDIR /usr/src/app

# Open http port
EXPOSE 8080

# Run app
CMD cp -a /tmp/app/. ./ && npm start
