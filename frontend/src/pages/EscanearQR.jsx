import { useEffect, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import "./Home.css";


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


    <main className="home-container">


      <header className="header">


        <div>

          <h1>
            Escanear código QR 📷
          </h1>


          <p>
            Identificación automática de sala
          </p>


        </div>


      </header>






      <section className="welcome">


        <h2>
          Escanea el código de la sala
        </h2>


        <p>
          Apunta la cámara al QR instalado en el aula.
        </p>





        {
          !sala &&

          <div id="reader"></div>

        }






        {
          sala &&

          <div className="menu-card qr">


            <div className="icon">
              ✅
            </div>



            <div>

              <h3>
                Sala identificada
              </h3>


              <p>
                Código:
                <b> {sala}</b>
              </p>


            </div>



          </div>


        }





      </section>



    </main>


  )


}


export default EscanearQR;