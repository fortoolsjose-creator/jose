-- "Rentabilidad por región": el reporte agrupa por colonia / alcaldía (municipio)
-- / ciudad. colonia y municipio ya existían; falta ciudad.
alter table public.properties
  add column if not exists ciudad text;

-- Precarga de zonas DEDUCIDAS de las direcciones reales del sitio
-- metrosredondos.com (revísalas y ajústalas en Editar propiedad).
-- Solo se llenan las que se conocen con seguridad; las dudosas quedan en blanco.
update public.properties set colonia = 'San Rafael',        municipio = 'Cuauhtémoc',   ciudad = 'CDMX'      where name like 'COV%'      and deleted_at is null;
update public.properties set colonia = 'Del Valle',          municipio = 'Benito Juárez', ciudad = 'CDMX'     where name = 'AME'          and deleted_at is null;
update public.properties set colonia = 'Roma Norte',         municipio = 'Cuauhtémoc',   ciudad = 'CDMX'      where name = 'Medellín'     and deleted_at is null;
update public.properties set colonia = 'Hipódromo Condesa',  municipio = 'Cuauhtémoc',   ciudad = 'CDMX'      where name = 'Campeche'     and deleted_at is null;
update public.properties set colonia = 'Santa Fe',                                        ciudad = 'CDMX'      where name = 'Isola'        and deleted_at is null;
update public.properties set colonia = 'Bosque de las Lomas',                             ciudad = 'CDMX'      where name = 'Alisos'       and deleted_at is null;
update public.properties set                                                              ciudad = 'Querétaro' where name = 'Naves'        and deleted_at is null;
