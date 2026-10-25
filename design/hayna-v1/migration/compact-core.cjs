const fs=require('fs');
const p='lib/oasis.ts';let s=fs.readFileSync(p,'utf8').replace('Approved Hayna Oasis design tokens. Logical pixels; assets have 1x/2x/3x densities.','Hayna compact interface tokens. React Native units map to iOS points.');
const replacements={'#F5F3E9':'#F2F2F7','#FFFEFA':'#FFFFFF','#173F30':'#1C1C1E','#63766A':'#636366','#D5E4D9':'#E5E5EA','#E9F3EC':'#EAF5EF','#F1F5EE':'#F2F2F7'};
for(const [a,b] of Object.entries(replacements))s=s.replaceAll(a,b);
s=s.replace('chip: 36, compact: 40, icon: 44, standard: 48, form: 52, prominent: 56, hero: 62','chip: 32, compact: 36, icon: 44, standard: 44, form: 44, prominent: 48, hero: 48').replace('input: 14, card: 20, sheet: 24','input: 10, card: 14, sheet: 20');fs.writeFileSync(p,s);
