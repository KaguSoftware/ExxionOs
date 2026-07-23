-- Links: multiple external URLs per entity, shown in detail views.
alter table machines    add column if not exists links text[] not null default '{}';
alter table supplies    add column if not exists links text[] not null default '{}';
alter table products    add column if not exists links text[] not null default '{}';
alter table orders      add column if not exists links text[] not null default '{}';
alter table clients     add column if not exists links text[] not null default '{}';
alter table campaigns   add column if not exists links text[] not null default '{}';
alter table collections add column if not exists links text[] not null default '{}';
