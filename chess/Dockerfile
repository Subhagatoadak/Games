FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html engine.js /usr/share/nginx/html/
COPY models/ /usr/share/nginx/html/models/
EXPOSE 80
