const fs=require('fs');const p='app/_layout.tsx';let s=fs.readFileSync(p,'utf8').replaceAll("<View style={{ flex: 1, backgroundColor: C.bg }} />",'<PendingScreen />');fs.writeFileSync(p,s);
