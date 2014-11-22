FROM    debian:7.4
FROM	debian:7.4
MAINTAINER Mike Gorianskyi goreanski@gmail.com
ENV		HOME /root
ENV		DEBIAN_FRONTEND noninteractive

RUN		apt-get update && apt-get install -y apt-utils curl
RUN     curl -sL https://deb.nodesource.com/setup | bash -
RUN     apt-get install -y nodejs
RUN     mkdir -p /var/www/unsee/

RUN     npm install socket.io redis express

ADD     chat.js /var/www/unsee/chat.js

CMD     nodejs /var/www/unsee/chat.js
