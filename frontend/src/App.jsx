import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import StmPage from "./pages/StmPage";
import PlayerPage from "./pages/PlayerPage";
import ScorePage from "./pages/ScorePage";
import TranscribePage from "./pages/TranscribePage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/stm32" element={<StmPage />} />
        <Route path="/player" element={<PlayerPage />} />
        <Route path="/score" element={<ScorePage />} />
        <Route path="/transcribe" element={<TranscribePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
