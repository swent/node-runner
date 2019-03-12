FROM node:lts-stretch

# Create directories
WORKDIR /tmp/app
RUN mkdir /usr/src/dropins

# Copy app
COPY package.json ./
COPY *.js ./

# Restore packages
RUN npm install

# Copy everything to final dir
WORKDIR /usr/src/app
RUN cp -a /tmp/app/. ./

# Open http port
EXPOSE 8080

# Run app
CMD [ "npm", "start" ]
