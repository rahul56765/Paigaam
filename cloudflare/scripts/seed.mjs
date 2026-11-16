#!/usr/bin/env node
// Generates INSERT-ONLY catalog SQL. Does not contact a service or change data.
// Existing template prices/configuration always win. Review before applying.
import fs from 'node:fs';
import {list as family} from '../src/catalog.generated.mjs';
import {letters} from '../src/legacy-letters.mjs';
const list = [...family, ...letters];
const literal=x=>typeof x==='number'?String(x):"'"+String(x).replaceAll("'","''")+"'";
const sql=list.map(t=>'INSERT INTO templates(slug,name,price,currency,config) VALUES('+[t.slug,t.config.name,Math.round((t.config.price||0)*100),'INR',JSON.stringify(t.config)].map(literal).join(',')+') ON CONFLICT(slug) DO NOTHING;').join('\n')+'\n';
fs.writeFileSync(new URL('../seed.generated.sql',import.meta.url),sql);console.log(`Generated ${list.length} insert-only catalog statements.`);
