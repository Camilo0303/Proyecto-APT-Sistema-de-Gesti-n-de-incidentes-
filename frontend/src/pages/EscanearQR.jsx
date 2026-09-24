import { useEffect, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import "./EscanearQR.css";


function EscanearQR() {


  const [sala, setSala] = useState(null);



  useEffect(() => {


    const scanner = new Html5QrcodeScanner(
      "reader",
      {
        fps:10,
        qrbox:{
          width:250,
          height:250
        }
      },
      false
    );



    scanner.render(

      (decodedText)=>{


        console.log(
          "QR leído:",
          decodedText
        );


        setSala(decodedText);


        scanner.clear();


      },


      ()=>{}

    );



    return ()=>{

      scanner.clear()
      .catch(()=>{});

    };


  },[]);





  return (


    <main className="qr-page">


      <section className="qr-header">


        <h1>
          📷 Escanear código QR
        </h1>


        <p>
          Identificación automática de sala
        </p>


      </section>





      <section className="qr-container">


        {
          !sala &&

          <>


          <h2>
            Escanea el código de la sala
          </h2>


          <p>
            Apunta la cámara al código QR instalado en el aula.
          </p>



          <div className="scanner-box">


            <div id="reader"></div>


          </div>



          </>

        }





        {
          sala &&


          <div className="qr-success">


            <div className="success-icon">
              ✅
            </div>


            <h2>
              Sala identificada correctamente
            </h2>


            <p>
              Código detectado:
            </p>


            <strong>
              {sala}
            </strong>


            <button
              className="continue-button"
            >

              Reportar incidencia

            </button>


          </div>


        }



      </section>



    </main>


  )


}



export default EscanearQR;