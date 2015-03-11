FROM        unsee/base
MAINTAINER  Mike Gorianskyi goreanski@gmail.com

RUN         curl -sL https://deb.nodesource.com/setup | bash -
RUN         apt-get install -y nodejs
RUN         npm install socket.io redis express
RUN         mkdir -p /var/www/unsee/
ADD         chat.js /var/www/unsee/chat.js

CMD         nodejs /var/www/unsee/chat.js
