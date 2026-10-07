-- Run once in this Supabase project's SQL Editor. No existing expense data is changed.
begin;
create table if not exists public.receipts (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 image_path text not null unique,
 image_hash text not null check (image_hash ~ '^[0-9a-f]{64}$'),
 image_mime text not null check (image_mime in ('image/jpeg','image/png','image/webp')),
 status text not null default 'uploading' check (status in ('uploading','uploaded','analyzing','analyzed','confirmed')),
 merchant text check (length(merchant)<=120),
 receipt_date date,
 amount numeric(14,2) check (amount>0),
 currency text,
 category text not null default 'Diğer' check (category in ('Market','Yemek','Yakıt','Fatura','Ev','Çocuk','Sağlık','Giyim','Eğlence','İş','Diğer')),
 payment text not null default 'Diğer' check (payment in ('Nakit','Kredi Kartı','Banka Kartı','Havale / EFT','Diğer')),
 note text not null default '' check (length(note)<=500),
 products jsonb not null default '[]' check (jsonb_typeof(products)='array' and jsonb_array_length(products)<=200),
 warnings jsonb not null default '[]' check (jsonb_typeof(warnings)='array'),
 analysis_token uuid,
 analysis_started_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(owner_id,image_hash),
 check (split_part(image_path,'/',1)=owner_id::text),
 check (status<>'confirmed' or (amount is not null and receipt_date is not null and merchant is not null and length(trim(merchant))>0 and currency='TRY'))
);
create index if not exists receipts_owner_date on public.receipts(owner_id,created_at desc);
alter table public.receipts enable row level security;
drop policy if exists receipts_own on public.receipts;
create policy receipts_own on public.receipts for all to authenticated
 using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
revoke all on public.receipts from anon;
grant select,insert,update,delete on public.receipts to authenticated;

create or replace function public.receipt_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end; $$;
drop trigger if exists receipt_updated_at on public.receipts;
create trigger receipt_updated_at before update on public.receipts for each row execute function public.receipt_updated_at();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('receipts','receipts',false,10485760,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists receipts_files_select on storage.objects;
drop policy if exists receipts_files_insert on storage.objects;
drop policy if exists receipts_files_update on storage.objects;
drop policy if exists receipts_files_delete on storage.objects;
create policy receipts_files_select on storage.objects for select to authenticated
 using (bucket_id='receipts' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy receipts_files_insert on storage.objects for insert to authenticated
 with check (bucket_id='receipts' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy receipts_files_update on storage.objects for update to authenticated
 using (bucket_id='receipts' and (storage.foldername(name))[1]=(select auth.uid())::text)
 with check (bucket_id='receipts' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy receipts_files_delete on storage.objects for delete to authenticated
 using (bucket_id='receipts' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- Per-user daily cap and row lock prevent repeated clicks from starting parallel AI calls.
create table if not exists public.receipt_analysis_usage (
 owner_id uuid not null references auth.users(id) on delete cascade,
 usage_date date not null, calls integer not null default 0,
 primary key(owner_id,usage_date)
);
alter table public.receipt_analysis_usage enable row level security;
revoke all on public.receipt_analysis_usage from anon,authenticated;
create or replace function public.begin_receipt_analysis(receipt_id uuid) returns uuid
 language plpgsql security definer set search_path='' as $$
declare r public.receipts; t uuid:=gen_random_uuid(); n integer;
begin
 select * into r from public.receipts where id=receipt_id and owner_id=auth.uid() for update;
 if not found then raise exception 'Fiş bulunamadı.'; end if;
 if r.status in ('confirmed','uploading') then raise exception 'Fiş bu durumda okunamaz.'; end if;
 if r.status='analyzing' and r.analysis_started_at>now()-interval '3 minutes' then raise exception 'Fiş zaten okunuyor.'; end if;
 insert into public.receipt_analysis_usage(owner_id,usage_date,calls) values(auth.uid(),(now() at time zone 'UTC')::date,1)
 on conflict(owner_id,usage_date) do update set calls=receipt_analysis_usage.calls+1 where receipt_analysis_usage.calls<50 returning calls into n;
 if n is null then raise exception 'Günlük 50 okuma sınırına ulaşıldı.'; end if;
 update public.receipts set status='analyzing',analysis_token=t,analysis_started_at=now() where id=receipt_id;
 return t;
end; $$;
revoke all on function public.begin_receipt_analysis(uuid) from public,anon;
grant execute on function public.begin_receipt_analysis(uuid) to authenticated;

create or replace function public.confirm_receipt(
 receipt_id uuid,merchant_value text,date_value date,amount_value numeric,
 category_value text,payment_value text,note_value text,products_value jsonb
) returns public.receipts language plpgsql security invoker set search_path='' as $$
declare r public.receipts; p jsonb;
begin
 select * into r from public.receipts where id=receipt_id and owner_id=auth.uid() for update;
 if not found then raise exception 'Fiş bulunamadı.'; end if;
 if r.status in ('uploading','analyzing') then raise exception 'Yükleme veya okuma işleminin tamamlanmasını bekle.'; end if;
 if merchant_value is null or length(trim(merchant_value))=0 or date_value is null or amount_value is null or amount_value<=0 then raise exception 'Firma, tarih ve pozitif toplam zorunludur.'; end if;
 if products_value is null or jsonb_typeof(products_value)<>'array' then raise exception 'Ürün listesi geçersiz.'; end if;
 for p in select * from jsonb_array_elements(products_value) loop
  if jsonb_typeof(p)<>'object' or length(trim(coalesce(p->>'name','')))=0 or length(p->>'name')>160 then raise exception 'Ürün adı geçersiz.'; end if;
  if p->>'quantity' is not null and (p->>'quantity')::numeric<=0 then raise exception 'Ürün miktarı pozitif olmalıdır.'; end if;
  if p->>'total' is not null and (p->>'total')::numeric<0 then raise exception 'Ürün tutarı negatif olamaz.'; end if;
 end loop;
 update public.receipts set merchant=trim(merchant_value),receipt_date=date_value,amount=round(amount_value,2),currency='TRY',
 category=category_value,payment=payment_value,note=coalesce(note_value,''),products=products_value,status='confirmed',analysis_token=null
 where id=receipt_id returning * into r;
 return r;
end; $$;
revoke all on function public.confirm_receipt(uuid,text,date,numeric,text,text,text,jsonb) from public,anon;
grant execute on function public.confirm_receipt(uuid,text,date,numeric,text,text,text,jsonb) to authenticated;
commit;
