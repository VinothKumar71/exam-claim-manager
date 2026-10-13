import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load from .env manually since this is a plain script
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(url, key);

// We need to parse the defaults.ts or just hardcode some for now
// Actually, I can't easily import TS from plain JS without transpile.
// I'll read the defaults.ts file content and extract the arrays using regex.

const defaultsPath = path.join('src', 'data', 'defaults.ts');
const defaultsContent = fs.readFileSync(defaultsPath, 'utf8');

function extractArray(content, varName) {
  const regex = new RegExp(`export const ${varName}.*?= \\[([\\s\\S]*?)\\];`, 'm');
  const match = content.match(regex);
  if (!match) return [];
  // Use a dirty hack to parse the array or just use simple regex for objects
  // Since it's a script, I'll just use eval on the extracted string (carefully)
  try {
    return eval(`[${match[1]}]`);
  } catch (e) {
    console.error(`Failed to parse ${varName}:`, e);
    return [];
  }
}

const colleges = extractArray(defaultsContent, 'INITIAL_COLLEGES');
const subjects = extractArray(defaultsContent, 'INITIAL_SUBJECTS');
const examiners = extractArray(defaultsContent, 'INITIAL_EXAMINERS');

async function seed() {
  console.log('Testing connection...');
  const { data: test, error: testErr } = await supabase.from('colleges').select('count', { count: 'exact', head: true });
  if (testErr) {
    console.error('Connection test failed. Did you run the SQL in Supabase?', testErr);
    return;
  }

  console.log('Seeding Colleges...');
  const { error: colErr } = await supabase.from('colleges').upsert(
    colleges.map(c => ({ code: c.code, name: c.name, abbreviated: c.abbreviated })),
    { onConflict: 'code' }
  );
  if (colErr) console.error('Colleges error:', colErr);
  else console.log(`Seeded ${colleges.length} colleges`);

  console.log('Seeding Subjects...');
  const { error: subErr } = await supabase.from('subjects').upsert(
    subjects.map(s => ({ code: s.code, name: s.name, department: s.department })),
    { onConflict: 'code' }
  );
  if (subErr) console.error('Subjects error:', subErr);
  else console.log(`Seeded ${subjects.length} subjects`);

  console.log('Seeding Examiners...');
  // Since there's no unique constraint on name, we'll delete and re-insert for a clean seed
  // or just filter out ones that already exist if we had a key.
  // For now, let's just try inserting.
  const { error: exErr } = await supabase.from('examiners').insert(
    examiners.map(e => ({ 
      name: e.name, 
      designation: e.designation, 
      role: e.role, 
      college_code: e.collegeCode,
      contact_number: e.contactNumber || null,
      bank_details: e.bankDetails || null
    }))
  );
  if (exErr) {
    if (exErr.code === '23505') {
       console.log('Examiners already exist (Unique constraint hit).');
    } else {
       console.error('Examiners error:', exErr);
    }
  }
  else console.log(`Seeded ${examiners.length} examiners`);
}

seed();
