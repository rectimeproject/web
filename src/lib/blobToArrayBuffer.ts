export default async function blobToArrayBuffer(
  blob: Blob
): Promise<ArrayBuffer> {
  if ('arrayBuffer' in Blob.prototype) {
    return blob.arrayBuffer();
  }
  return await new Promise<ArrayBuffer>((resolve, reject) => {
    const fr = new FileReader();
    fr.onloadend = () => {
      if (!(fr.result instanceof ArrayBuffer)) {
        reject(new Error('FileReader returned result with invalid type'));
        return;
      }
      resolve(fr.result);
    };
    fr.readAsArrayBuffer(blob);
  });
}
