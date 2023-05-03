import Tutorial from "./Tutorial.js";
import { Container } from "@inlet/react-pixi";
import Chapter from "./Chapter.js";
import { useState, useEffect } from "react";
import { conjectures } from "../models/conjectures.js";
import Latin from "./utilities/latin_square";
import { useMachine, useSelector } from "@xstate/react";
// import { useSelector } from "@xstate";
import GameMachine from "../machines/gameMachine.js";
import Intervention from "./Intervention.js";
import { promiseChecker, writeToDatabase } from "../firebase/database.js";

const reorder = (array, indices) => {
  return indices.map((idx) => array[idx - 1]);
};

const context = {
  context: {
    conjectures: [0, 1, 2, 3, 4, 5, 6, 7],
    currentConjectureIdx: 0,
    conjectureIdxToIntervention: 4,
  },
};
const selectCurrentConjectureIdx = (state) =>
  state.context.currentConjectureIdx;

const Game = (props) => {
  const { columnDimensions, rowDimensions, poseData, height, width } = props;
  const [chapterConjecture, setChapterConjecture] = useState([]);

  const [performTutorial, setPerformTutorial] = useState(true);
  // const [performTutorial, setPerformTutorial] = useState(false);
  const [allConjectures, setAllConjectures] = useState([]);
  const [state, send, service] = useMachine(GameMachine, context);
  const currentConjectureIdx = useSelector(service, selectCurrentConjectureIdx);

  // Database Write Functionality
  // This code runs when the user is participating in a conjecture and recording is enabled.

  // The following code runs once when the component mounts.
  useEffect(() => {
    // Optional URL parameters for whether motion data recording is enabled
    // and what the fps is for recording.
    // Defaults are false and 30.
    const queryParameters = new URLSearchParams(window.location.search);

    // Get the recording parameter from the URL. If it's not set, default to false.
    const recordingUrlParam = queryParameters.get("recording") || "false";

    // If the recording param is set to true, begin writing data to the database.
    if (recordingUrlParam.toLowerCase() === "true") {
      // Get the fps parameter from the URL. If it's not set, default to 30.
      const fpsUrlParam = parseInt(queryParameters.get("fps")) || 30;

      // Empty array to hold the promise objects.
      // This is important so we can assure that all the promises get settled on component unmount.
      let promises = [];

      // This creates an interval for the writing to the database every n times a second,
      // where n is a variable framerate.
      const intervalId = setInterval(() => {
        // Call the writeToDatabase function with the current poseData, conjecture index,
        // and fps parameter. Push the resulting promise object to the promises array.
        promises.push(
          writeToDatabase(poseData, currentConjectureIdx, fpsUrlParam)
        );
        // Call the promiseChecker function to detect any data loss in the promises array
        // and trigger an alert if necessary.
        promiseChecker(fpsUrlParam, promises);
      }, 1000 / fpsUrlParam);

      // The code below runs when the component unmounts.
      return async () => {
        // Stop the interval when the component unmounts.
        clearInterval(intervalId);

        // Wait until all promises are settled so we don't lose data.
        await Promise.allSettled(promises);
      };
    }
  }, []);

  useEffect(() => {
    const numConjectures = conjectures.length;
    const latinSquare = new Latin(numConjectures);
    const queryParams = new URLSearchParams(window.location.search);
    let condition = 0;
    if (queryParams.has("condition")) {
      condition = parseInt(queryParams.get("condition"));
    }
    const conjectureOrder =
      condition < numConjectures
        ? latinSquare.square[condition]
        : latinSquare.square[0];
    let orderedConjectures = reorder(conjectures, conjectureOrder);
    if (queryParams.has("conjecture")) {
      const conjectureStart = parseInt(queryParams.get("conjecture"));
      setPerformTutorial(false);
      send({
        type: "SET_CURRENT_CONJECTURE",
        currentConjectureIdx: conjectureStart - 1,
      });
    }
    setAllConjectures(orderedConjectures);
  }, []);

  useEffect(() => {
    setChapterConjecture(allConjectures[currentConjectureIdx]);
    // since allConjectures is also set asyncronously, monitor
    // allConjectures and currentConjectureIdx to update chapterConjecture
  }, [allConjectures, currentConjectureIdx]);

  return (
    <Container>
      {performTutorial && (
        <Tutorial
          poseData={poseData}
          columnDimensions={columnDimensions}
          rowDimensions={rowDimensions}
          onComplete={() => {
            setPerformTutorial(false);
            send("NEXT");
          }}
        />
      )}
      {!performTutorial && state.value === "chapter" && (
        <Chapter
          poseData={poseData}
          columnDimensions={props.columnDimensions}
          rowDimensions={props.rowDimensions}
          height={height}
          width={width}
          chapterConjecture={chapterConjecture}
          currentConjectureIdx={state.context.currentConjectureIdx}
          nextChapterCallback={() => send("NEXT")}
        />
      )}
      {!performTutorial && state.value === "intervention" && (
        <Intervention triggerNextChapter={() => send("NEXT")} />
      )}
    </Container>
  );
};

export default Game;
