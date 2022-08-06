document.addEventListener('DOMContentLoaded', () => {
  var inputText=document.getElementById('inputText');

  var judgement;

  // func will be attached to the downloadText
  function getCurrentDatetimeStamp() {
    const d = new Date();
    var datestamp=d.getFullYear()+''+(d.getMonth()+1)+''+d.getDate();
    var timestamp=d.getHours()+''+d.getMinutes()+''+d.getSeconds();

    var datetimeStr=datestamp+'_'+timestamp;
    return datetimeStr;
  }

  var downloadTextContent=document.getElementById('downloadTextContent');

  // handling the download functionality once the text file is made
  downloadTextContent.addEventListener('click', (evt) => {
    if (!window.Blob) {
      alert('Your browser does not support HTML5 "Blob" function required to save a file.');
    } else {
      let textblob = new Blob([inputText.value], {
          type: 'application/plaintext'
      });
      let dwnlnk = document.createElement('a');
      // formatting the final name of the text file which will be downloaded
      dwnlnk.download = 'pdfText_'+getCurrentDatetimeStamp()+'.txt';
      if (window.webkitURL != null) {
          dwnlnk.href = window.webkitURL.createObjectURL(textblob);
      }
      dwnlnk.click();
    }
  }, false);

  const tesseractWorkerPath='js/tesseract/worker.min.js';

  function readFileAsDataURL(file) {
    return new Promise((resolve,reject) => {
        let fileredr = new FileReader();
        fileredr.onload = () => resolve(fileredr.result);
        fileredr.onerror = () => reject(fileredr);
        fileredr.readAsDataURL(file);
    });
  }

  var pageLoadingSignal=document.getElementById('pageLoadingSignal');
  var pagePreview=document.getElementById('page-preview');
  var ocrPageProgress=document.getElementById('ocrPageProgress');
  var ocrPageProgressStatus=document.getElementById('ocrPageProgressStatus');
  
  var processedPages=document.getElementById('processedPages');
  var totalPages=document.getElementById('totalPages');

  // extracting the pdf details
  var _PDF_DOC,
      _PAGE,
      _ZOOM_FACTOR = 1,
      currentPage = 1,
      noOfPages,
      _CANVAS=document.createElement('canvas');

  var uploadPDFBtn=document.getElementById('uploadPDFBtn');
  var uploadPDF=document.getElementById('uploadPDF');

  uploadPDF.addEventListener('click', () => 
    {
      judgement=document.getElementById('judgementOnly').checked; 
      // alert(judgement);
      document.getElementById('objectDiv').style.display = 'flex';
    }
  );

  // variables that will be helping the process liek mapping pdf to lang and vice versa
  let pdfname = "";
  const mapPdfToLang = ['ap','chat','guj','hry','mah','orr','pud','pun','raj','up','mp','hin1'];
  const mapLangToPdf = ['tel','hin','guj','eng','mar','kan','tam','eng','hin','hin','hin','hin'];

  let langModel = "";

  uploadPDF.addEventListener('change', function(evt) {
      let file = evt.currentTarget.files[0];
      console.log(file.name);
      pdfname = file.name;
      if(!file) return;
      readFileAsDataURL(file).then((b64str) => {
        showPDF(b64str);
      }, false);
  });

  async function showPage(pageNo) {
      currentPage = pageNo;
      currentPageNo.innerHTML = pageNo;
      try {
          _PAGE = await _PDF_DOC.getPage(pageNo);
      } catch(error) {
          console.log(error.message);
      }
      return new Promise((resolve => resolve(_PAGE)));
  }
  
  var pdfWorker;
  async function initPdfTesseractWorker() {
    pdfWorker = Tesseract.createWorker({
        workerPath: tesseractWorkerPath,
        langPath:  tesseractLangPath,
        corePath: tesseractCorePath,
        logger: msg => {
          // console.log(msg);
          if(msg.status=='recognizing text') {
            ocrPageProgress['style']['width']=`${parseInt(parseFloat(msg.progress)*100)}%`;
            ocrPageProgressStatus.innerHTML=`<p class='mb-1 mt-1'>⏳ <strong>${parseInt(parseFloat(msg.progress)*100)}%</strong></p>`;
          }
        }
    });
    // Tesseract.setLogging(true);

    await pdfWorker.load();

    pdfname = pdfname.split('.')[0];

    // deafult l=model for other pdfs (rather than the server ones)
    langModel = 'eng';

    // finding/mapping the language of the pdf
    mapPdfToLang.map((pdf, ind) => {
      if(pdf == pdfname) return langModel =  mapLangToPdf[ind]; 
    });

    console.log('Language model is: ', langModel);

    // initiating the tranied language model for the particular language
    await pdfWorker.loadLanguage(langModel);
    await pdfWorker.initialize(langModel);

    return new Promise((resolve) => resolve('worker initialised.')).then(console.log('Worker Initiated'));
  }

  const loadImage = (url) => new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', (err) => reject(err));
    img.src = url;
  });

  async function extractPdfText(loadedImg) {
    const result=await pdfWorker.recognize(loadedImg);
    // console.log(result);

    let data=result.data;

    let words=data.words;
    let combinedText='';
    for(let w of words) {
      let str=(w.text);
      let newStr = ( str.length>1 && str.charAt(str.length-1)=='-' ) ? str.substr(0,str.length-1) : (str+' ');
      combinedText+=newStr;
    }
    inputText.insertAdjacentText('beforeend', (' ' + combinedText));
    ocrPageProgress['style']['width']='100%';
    ocrPageProgress.classList.remove('progress-bar-animated');
    ocrPageProgressStatus.innerHTML=`<p class='mb-1 mt-1'>⌛ <strong>Done.</strong></p>`;

    // if last page (in my case it will be 2 always) is traversed
    if(currentPage == noOfPages) {
      const fullText = inputText.value;
      console.log('🎉🎉🎉🎉Last page done');
      console.log(fullText);
      
      // sending a request to the backend (app.js)
      fetch('/extractText', {
        method: 'post',
        headers: {'Content-type': 'application/json'},
        body: JSON.stringify({
          text: fullText,
          pdfname: pdfname,
          judgement: judgement
        })
      })
      // handle response given by the backend side  
      .then(res => res.json()).then(res => {
        const objectAns = document.querySelector('#insertObject');
          for (const [key, value] of Object.entries(res)) {
            var para = document.createElement("p");
            var text = document.createTextNode("'"+key+"' : "+value+" ,");
            para.appendChild(text);
            objectAns.appendChild(para);
            downloadTextContent.style.display = "inline-block";
          }
        // turning of the loader
        document.querySelector('#loader').style.display = "none";
      });
    }
    return new Promise((resolve) => resolve('extraction done.')).then(console.log('Extraction done for page: '+currentPage));
  }

  async function showPDF(pdf_url) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/pdf/pdf.worker.min.js';
    try {
        _PDF_DOC = await pdfjsLib.getDocument({ url: pdf_url });
    } catch(error) {
        console.log(error.message);
    }
    noOfPages = _PDF_DOC.numPages;
    
    // if the judgement box has been checked in 
    
    if(judgement)  {
      currentPage = noOfPages;
    } else if(noOfPages > 1) {
      noOfPages = 1;
    }

    // if(document.querySelector('#judgementOnly').checked) currentPage = noOfPages;

    totalPages.innerHTML = noOfPages;

    while(currentPage<=noOfPages) {
      await initPdfTesseractWorker();

      pageLoadingSignal['style']['visibility']='visible';
      currentPageNo.innerHTML=currentPage;

      _PAGE=await showPage(currentPage);
      let b64str=await scalePDFPage();
      pagePreview['style']['background-image']='url("'+b64str+'")';

      let loadedImg = await loadImage(b64str); 
      await extractPdfText(loadedImg);
      processedPages.insertAdjacentHTML('beforeend', "<p class='d-inline-block mb-1 mt-1'>🟤 <a href='"+b64str+"' download='"+currentPage+".png'>Page "+currentPage+"</a></p>");

      await pdfWorker.terminate();

      currentPage++;
    } // end-while loop

    pageLoadingSignal['style']['visibility']='hidden';
  }
  
  const pixelRatio=window.devicePixelRatio*2;
  async function scalePDFPage() {
      let pdfOriginalWidth = _PAGE.getViewport(_ZOOM_FACTOR).width;
      let viewport = _PAGE.getViewport(_ZOOM_FACTOR);
      let viewpointHeight=viewport.height;

      _CANVAS.width=pdfOriginalWidth*pixelRatio;
      _CANVAS.height=viewpointHeight*pixelRatio;

      _CANVAS['style']['width'] = `${pdfOriginalWidth}px`;
      _CANVAS['style']['height'] = `${viewpointHeight}px`;

      _CANVAS.getContext('2d').scale(pixelRatio, pixelRatio);

      var renderContext = {
          canvasContext: _CANVAS.getContext('2d'),
          viewport: viewport
      };
      try {
          await _PAGE.render(renderContext);
      } catch(error) {
          alert(error.message);
      }
      return new Promise((resolve => resolve(_CANVAS.toDataURL())));
  }
});
