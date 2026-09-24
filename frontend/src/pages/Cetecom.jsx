import "./Cetecom.css";

function Cetecom() {

    const incidencias = [
        {
            id: 1,
            problema: "Computador no enciende",
            categoria: "Computadores",
            sala: "203",
            estado: "Pendiente"
        },
        {
            id: 2,
            problema: "Proyector sin imagen",
            categoria: "Proyectores",
            sala: "101",
            estado: "En proceso"
        }
    ];

    return (
        <div className="cetecom-container">

            <h1>Panel Cetecom</h1>

            <p>
                Gestión de incidencias tecnológicas
            </p>


            <div className="cards">

                <div className="card">
                    <h3>Pendientes</h3>
                    <span>12</span>
                </div>

                <div className="card">
                    <h3>En proceso</h3>
                    <span>5</span>
                </div>

                <div className="card">
                    <h3>Cerradas</h3>
                    <span>30</span>
                </div>

            </div>


            <h2>Incidencias Tecnológicas</h2>


            <table>

                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Problema</th>
                        <th>Categoría</th>
                        <th>Sala</th>
                        <th>Estado</th>
                    </tr>
                </thead>


                <tbody>

                    {incidencias.map((item)=>(
                        <tr key={item.id}>
                            <td>{item.id}</td>
                            <td>{item.problema}</td>
                            <td>{item.categoria}</td>
                            <td>{item.sala}</td>
                            <td>{item.estado}</td>
                        </tr>
                    ))}

                </tbody>

            </table>

        </div>
    );
}

export default Cetecom;