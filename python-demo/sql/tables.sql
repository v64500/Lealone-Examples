
drop table if exists user;

create table if not exists user (
  id long auto_increment primary key,
  name varchar,
  age int
) package 'org.lealone.examples.python' generate code './src/main/java';

