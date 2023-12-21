FROM busybox:latest

ADD https://repo1.maven.org/maven2/org/postgresql/postgresql/42.7.0/postgresql-42.7.0.jar /opt/component/storage/jdbc/driver/postgres/
ADD https://repo1.maven.org/maven2/com/mysql/mysql-connector-j/8.2.0/mysql-connector-j-8.2.0.jar /opt/component/storage/jdbc/driver/mysql/

ENTRYPOINT ["busybox"]
CMD ["top", "-b"]