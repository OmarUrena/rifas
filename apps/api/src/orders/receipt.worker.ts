import { parentPort, workerData } from 'node:worker_threads';
import sharp from 'sharp';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFObject, PDFRawStream } from 'pdf-lib';

let rejectionReason='FILE_STRUCTURE';
async function validate() {
  const {bytes,mime}=workerData as {bytes:Uint8Array;mime:string};
  const input=Buffer.from(bytes);
  if(mime==='image/jpeg'||mime==='image/png') {
    rejectionReason='IMAGE_SIGNATURE';
    const jpeg=input[0]===255&&input[1]===216&&input[2]===255;
    const png=input.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    if((mime==='image/jpeg'&&!jpeg)||(mime==='image/png'&&!png))throw new Error();
    rejectionReason='IMAGE_DECODE';
    const image=sharp(input,{limitInputPixels:10000000,failOn:'warning',animated:false});
    const meta=await image.metadata();
    rejectionReason='IMAGE_PAGES';
    if(meta.pages && meta.pages!==1)throw new Error();
    rejectionReason='IMAGE_DECODE';
    // Decodificación completa sin modificar el comprobante archivado.
    await image.raw().toBuffer();
    return {bytes:input,mime,extension:jpeg?'jpg':'png'};
  }
  rejectionReason='PDF_STRUCTURE';
  const trailer=input.subarray(-1024).toString().match(/startxref\s+(\d+)\s+%%EOF\s*$/);
  if(mime!=='application/pdf'||!input.subarray(0,8).toString().match(/^%PDF-1\.[0-7]/)||!trailer)throw new Error();
  const offset=Number(trailer[1]);
  if(offset>=input.length||!input.subarray(offset,offset+64).toString().match(/^(?:xref\b|\d+\s+\d+\s+obj\b)/))throw new Error();
  rejectionReason='PDF_DECODE';
  const pdf=await PDFDocument.load(input,{ignoreEncryption:false,throwOnInvalidObject:true,updateMetadata:false});
  rejectionReason='PDF_PAGES';
  if(pdf.getPageCount()<1||pdf.getPageCount()>20)throw new Error();
  const denied=new Set(['JS','JavaScript','OpenAction','AA','Launch','EmbeddedFiles','EmbeddedFile','RichMedia','XFA','AcroForm','URI','GoToR','SubmitForm','ImportData']);
  const visited=new Set<PDFObject>();
  const inspect=(object:PDFObject)=>{
    if(visited.has(object))return;visited.add(object);
    if(object instanceof PDFName && denied.has(object.decodeText()))throw new Error();
    if(object instanceof PDFDict)for(const [key,value] of object.entries()){inspect(key);inspect(value);}
    if(object instanceof PDFArray)for(const value of object.asArray())inspect(value);
    if(object instanceof PDFRawStream)inspect(object.dict);
  };
  rejectionReason='PDF_CONTENT';
  for(const [,object] of pdf.context.enumerateIndirectObjects())inspect(object);
  return {bytes:input,mime,extension:'pdf'};
}
void validate().then(result=>parentPort!.postMessage(result)).catch(()=>parentPort!.postMessage({invalid:true,reason:rejectionReason}));
