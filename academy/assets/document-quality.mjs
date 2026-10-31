export function qualityMetrics(data,width,height){
 if(width<1||height<1||data.length!==width*height*4)throw Error('Imagem inválida');
 let sum=0,squares=0,edges=0,n=width*height;
 const grey=new Float64Array(n);
 for(let i=0;i<n;i++){const v=.2126*data[4*i]+.7152*data[4*i+1]+.0722*data[4*i+2];grey[i]=v;sum+=v;squares+=v*v;}
 const mean=sum/n,contrast=Math.sqrt(Math.max(0,squares/n-mean*mean));
 for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){const i=y*width+x;const lap=grey[i-1]+grey[i+1]+grey[i-width]+grey[i+width]-4*grey[i];edges+=lap*lap;}
 const detail=edges/Math.max(1,(width-2)*(height-2));
 const warnings=[];if(mean<45)warnings.push('Foto escura');if(mean>245)warnings.push('Foto muito clara');if(contrast<18)warnings.push('Pouco contraste');if(detail<25)warnings.push('Poucos detalhes: confira o foco e o texto');
 const score=Math.round(Math.max(0,Math.min(100,100-warnings.length*22)));
 return {score,mean,contrast,detail,warnings,disclaimer:'Estimativa técnica da imagem; não identifica falsificação nem garante legibilidade ou completude.'};
}
export function detectFormat(bytes){if(bytes[0]===0x25&&bytes[1]===0x50&&bytes[2]===0x44&&bytes[3]===0x46&&bytes[4]===0x2d)return 'application/pdf';if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'image/jpeg';if(bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47)return 'image/png';return null;}
