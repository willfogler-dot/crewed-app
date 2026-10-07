// A small .xlsx writer: styled cells, column widths, merged cells, frozen headers and print setup.
// Pure, no dependencies, works offline. xlsxBuild(sheets, title) -> Uint8Array.
//   sheet: { name, cols:[width,...], rows:[[cell,...],...], freeze:rowCount, merges:['A1:F1'], heads:rowCount }
//   cell:  string | number | null | { v, s }   where s is a style name from XLSX_STYLES
var XLSX_STYLES = ['plain','title','sub','head','cell','bold','num','warn','muted','group','check','big'];
function xlsxBuild(sheets, title){
  var enc=new TextEncoder();
  function x(s){ return String(s==null?'':s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function col(n){ var s=''; n++; while(n>0){ var r=(n-1)%26; s=String.fromCharCode(65+r)+s; n=Math.floor((n-1)/26); } return s; }
  var INK='FF161D3A', MIST='FFE3E7F3', HAIR='FFD5DAE8', AMBER='FFFFF1CC', GREY='FF666E8C', RED='FFC8322F';
  function font(sz,b,color){ return '<font>'+(b?'<b/>':'')+'<sz val="'+sz+'"/><color rgb="'+color+'"/><name val="Calibri"/><family val="2"/></font>'; }
  function fill(c){ return '<fill><patternFill patternType="solid"><fgColor rgb="'+c+'"/><bgColor indexed="64"/></patternFill></fill>'; }
  var styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
    '<fonts count="8">'+font(10,0,INK)+font(18,1,'FFFFFFFF')+font(10,0,'FFDDE2F2')+font(9,1,INK)+font(10,1,INK)+font(10,1,RED)+font(9,0,GREY)+font(13,1,INK)+'</fonts>'+
    '<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'+fill(INK)+fill(MIST)+fill(AMBER)+'</fills>'+
    '<borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border>'+
      '<border><left/><right/><top/><bottom style="thin"><color rgb="'+HAIR+'"/></bottom><diagonal/></border>'+
      '<border><left/><right/><top/><bottom style="medium"><color rgb="'+INK+'"/></bottom><diagonal/></border></borders>'+
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
    '<cellXfs count="12">'+
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'+
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" indent="1"/></xf>'+
      '<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" indent="1"/></xf>'+
      '<xf numFmtId="0" fontId="3" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>'+
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'+
      '<xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'+
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf>'+
      '<xf numFmtId="0" fontId="5" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'+
      '<xf numFmtId="0" fontId="6" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'+
      '<xf numFmtId="0" fontId="4" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>'+
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>'+
      '<xf numFmtId="0" fontId="7" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'+
    '</cellXfs></styleSheet>';
  function sheetXml(sh){
    var rows=sh.rows, nc=0, i; rows.forEach(function(r){ nc=Math.max(nc,r.length); });
    var out='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
      '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:'+col(Math.max(0,nc-1))+Math.max(1,rows.length)+'"/>'+
      '<sheetViews><sheetView workbookViewId="0" showGridLines="0">'+
      (sh.freeze?'<pane ySplit="'+sh.freeze+'" topLeftCell="A'+(sh.freeze+1)+'" activePane="bottomLeft" state="frozen"/>':'')+'</sheetView></sheetViews>'+
      '<sheetFormatPr defaultRowHeight="15"/><cols>';
    for(i=0;i<nc;i++) out+='<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+((sh.cols&&sh.cols[i])||14)+'" customWidth="1"/>';
    out+='</cols><sheetData>';
    rows.forEach(function(r,ri){
      var st0=r[0]&&typeof r[0]==='object'?r[0].s:null, ht=st0==='title'?34:st0==='sub'?20:st0==='head'?24:st0==='group'?20:0;
      out+='<row r="'+(ri+1)+'"'+(ht?' ht="'+ht+'" customHeight="1"':'')+'>';
      r.forEach(function(c,ci){
        if(c==null||c==='') { if(st0==='title'||st0==='sub'||st0==='group'||st0==='head'){ out+='<c r="'+col(ci)+(ri+1)+'" s="'+XLSX_STYLES.indexOf(st0)+'"/>'; } return; }
        var v=(typeof c==='object')?c.v:c, s=(typeof c==='object'&&c.s)?XLSX_STYLES.indexOf(c.s):4; if(s<0) s=4;
        var ref=col(ci)+(ri+1);
        if(typeof v==='number' && isFinite(v)) out+='<c r="'+ref+'" s="'+s+'"><v>'+v+'</v></c>';
        else out+='<c r="'+ref+'" s="'+s+'" t="inlineStr"><is><t xml:space="preserve">'+x(v)+'</t></is></c>';
      });
      out+='</row>';
    });
    out+='</sheetData>';
    if(sh.merges&&sh.merges.length) out+='<mergeCells count="'+sh.merges.length+'">'+sh.merges.map(function(m){ return '<mergeCell ref="'+m+'"/>'; }).join('')+'</mergeCells>';
    out+='<printOptions horizontalCentered="1"/><pageMargins left="0.4" right="0.4" top="0.5" bottom="0.6" header="0.3" footer="0.3"/>'+
      '<pageSetup orientation="'+(sh.portrait?'portrait':'landscape')+'" fitToWidth="1" fitToHeight="0"/>'+
      '<headerFooter><oddFooter>&amp;L&amp;8'+x(title)+' · '+x(sh.name)+'&amp;R&amp;8Page &amp;P of &amp;N</oddFooter></headerFooter></worksheet>';
    return out;
  }
  var files=[];
  function add(name,str){ files.push({ name:name, data:enc.encode(str) }); }
  add('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+
    sheets.map(function(_,i){ return '<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('')+'</Types>');
  add('_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  add('xl/workbook.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
    '<sheets>'+sheets.map(function(s,i){ return '<sheet name="'+x(s.name.slice(0,31))+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>'; }).join('')+'</sheets>'+
    '<definedNames>'+sheets.map(function(s,i){ return s.heads?'<definedName name="_xlnm.Print_Titles" localSheetId="'+i+'">\''+x(s.name.slice(0,31)).replace(/'/g,"''")+'\'!$1:$'+s.heads+'</definedName>':''; }).join('')+'</definedNames></workbook>');
  add('xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
    sheets.map(function(_,i){ return '<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>'; }).join('')+
    '<Relationship Id="rId'+(sheets.length+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  add('xl/styles.xml',styles);
  sheets.forEach(function(s,i){ add('xl/worksheets/sheet'+(i+1)+'.xml', sheetXml(s)); });
  // zip, stored (no compression): small files, and nothing to go wrong
  var T=[], n, k; for(n=0;n<256;n++){ var c=n; for(k=0;k<8;k++) c=c&1?0xEDB88320^(c>>>1):c>>>1; T[n]=c>>>0; }
  function crc(d){ var c=0xFFFFFFFF; for(var i=0;i<d.length;i++) c=T[(c^d[i])&255]^(c>>>8); return (c^0xFFFFFFFF)>>>0; }
  var parts=[], central=[], off=0;
  function u16(v){ return [v&255,(v>>>8)&255]; } function u32(v){ return [v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255]; }
  files.forEach(function(f){
    var nm=enc.encode(f.name), cr=crc(f.data), sz=f.data.length;
    var lh=[].concat(u32(0x04034b50),u16(20),u16(0x0800),u16(0),u16(0),u16(0x21),u32(cr),u32(sz),u32(sz),u16(nm.length),u16(0));
    parts.push(new Uint8Array(lh),nm,f.data);
    central.push({ h:[].concat(u32(0x02014b50),u16(20),u16(20),u16(0x0800),u16(0),u16(0),u16(0x21),u32(cr),u32(sz),u32(sz),u16(nm.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(off)), nm:nm });
    off+=lh.length+nm.length+sz;
  });
  var cs=0; central.forEach(function(c){ parts.push(new Uint8Array(c.h),c.nm); cs+=c.h.length+c.nm.length; });
  parts.push(new Uint8Array([].concat(u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(cs),u32(off),u16(0))));
  var total=0; parts.forEach(function(p){ total+=p.length; });
  var out=new Uint8Array(total), at=0; parts.forEach(function(p){ out.set(p,at); at+=p.length; });
  return out;
}
if(typeof module!=='undefined') module.exports={ xlsxBuild:xlsxBuild };
