"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Mic,
  Plus,
  UploadCloud,
  X,
} from "lucide-react";
import { XIcon } from "@/components/common/Icons";
import { AppShell } from "@/components/layout/AppShell";
import { apiUrl } from "@/lib/api";
import { useStore } from "@/store/useStore";
import {
  ApiResponse,
  AssignmentResponse,
  GenerateResponse,
  SourceFile,
} from "@/types";

// Type declaration for Web Speech API
type SpeechRecognitionConstructor = {
  new (): SpeechRecognition;
};

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

const questionTypeChoices = [
  "Multiple Choice Questions",
  "Short Questions",
  "Diagram/Graph-Based Questions",
  "Numerical Problems",
  "Long Questions",
];
const difficultyChoices = ["Easy", "Moderate", "Challenging"] as const;
const MAX_SOURCE_FILE_SIZE = 10 * 1024 * 1024;

export default function CreatePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recognitionError, setRecognitionError] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const {
    createForm,
    setCreateFormField,
    updateQuestionType,
    replaceQuestionType,
    removeQuestionType,
    addQuestionType,
    addAssignment,
    resetCreateForm,
    setCurrentJob,
    setGeneratedPaper,
  } = useStore();

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Helper function to create and configure a new recognition instance
  const createRecognitionInstance = (): SpeechRecognition | null => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      return null;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let finalTranscript = "";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + " ";
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      // Update the textarea with combined text
      const currentText = createForm.additionalInfo || "";
      const newText = currentText + finalTranscript;
      setCreateFormField("additionalInfo", newText.trim());

      // Reset final transcript so we don't keep adding it
      finalTranscript = "";
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);

      const errorMessages: Record<string, string> = {
        "no-speech": "No speech detected. Please try again.",
        "audio-capture":
          "No microphone found. Please ensure your microphone is connected.",
        "not-allowed":
          "Microphone access denied. Please allow microphone access in your browser settings.",
        network: "Network error. Please check your internet connection.",
      };

      setRecognitionError(
        errorMessages[event.error] || `Error: ${event.error}`,
      );
      setTimeout(() => setRecognitionError(""), 5000);
    };

    recognition.onend = () => {
      // Auto-restart if user still wants recording (didn't manually stop)
      if (isRecording && !recognitionError) {
        setTimeout(() => {
          if (isRecording && !recognitionError) {
            const newRecognition = createRecognitionInstance();
            if (newRecognition) {
              try {
                newRecognition.start();
                recognitionRef.current = newRecognition;
              } catch (err) {
                console.error("Failed to restart speech recognition:", err);
                setIsRecording(false);
              }
            }
          }
        }, 500); // 500ms delay before restart
      } else {
        recognitionRef.current = null;
      }
    };

    return recognition;
  };

  const handleToggleRecording = () => {
    // Check if browser supports Speech Recognition
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setRecognitionError(
        "Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.",
      );
      setTimeout(() => setRecognitionError(""), 5000);
      return;
    }

    // Stop existing recording if active
    if (isRecording && recognitionRef.current) {
      // Set isRecording to false BEFORE stopping to prevent auto-restart
      setIsRecording(false);
      recognitionRef.current.stop();
      return;
    }

    // Clear any previous errors
    setRecognitionError("");

    // Create new recognition instance using helper function
    const recognition = createRecognitionInstance();

    if (!recognition) {
      setRecognitionError("Failed to initialize speech recognition.");
      setTimeout(() => setRecognitionError(""), 5000);
      return;
    }

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      setRecognitionError("Failed to start microphone. Please try again.");
      setTimeout(() => setRecognitionError(""), 5000);
    }
  };

  const totalQuestions = createForm.questionTypes.reduce(
    (sum, item) => sum + item.count,
    0,
  );
  const totalMarks = createForm.questionTypes.reduce(
    (sum, item) => sum + item.count * item.marks,
    0,
  );

  const handleSelectedFile = async (file: File | null) => {
    if (!file) {
      setCreateFormField("file", null);
      setCreateFormField("fileName", "");
      setCreateFormField("sourceFile", null);
      return;
    }

    if (file.size > MAX_SOURCE_FILE_SIZE) {
      throw new Error("File must be 10MB or smaller.");
    }

    const formData = new FormData();
    formData.append("file", file);

    const extractResponse = await fetch(apiUrl("/api/uploads/extract"), {
      method: "POST",
      body: formData,
    });

    if (!extractResponse.ok) {
      throw new Error(
        "Backend is not reachable. Please ensure the backend server is running.",
      );
    }

    const extractData =
      (await extractResponse.json()) as ApiResponse<SourceFile>;

    if (!extractData.success || !extractData.data) {
      throw new Error(
        extractData.error || "Unable to process the selected file.",
      );
    }

    setCreateFormField("file", file);
    setCreateFormField("fileName", file.name);
    setCreateFormField("sourceFile", extractData.data);
    setError("");
  };

  const handleGenerate = async () => {
    setSubmitting(true);
    setError("");

    try {
      const assignmentResponse = await fetch(apiUrl("/api/assignments"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createForm.title.trim() || `${createForm.subject} Assessment`,
          dueDate: createForm.dueDate,
          school: createForm.school,
          subject: createForm.subject,
          classLevel: createForm.classLevel,
          timeAllowed: createForm.timeAllowed,
          maxMarks: totalMarks,
          questionTypes: createForm.questionTypes,
          additionalInfo: createForm.additionalInfo,
          fileName: createForm.fileName,
          sourceFile: createForm.sourceFile,
        }),
      });

      if (!assignmentResponse.ok) {
        throw new Error(
          "Backend is not reachable. Please ensure the backend server is running.",
        );
      }

      const assignmentData =
        (await assignmentResponse.json()) as AssignmentResponse;

      if (!assignmentData.success || !assignmentData.data) {
        throw new Error(assignmentData.error || "Failed to create assignment");
      }

      addAssignment(assignmentData.data);
      setGeneratedPaper(null);

      const generateResponse = await fetch(apiUrl("/api/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: assignmentData.data.id,
          questionTypes: assignmentData.data.questionTypes,
        }),
      });

      if (!generateResponse.ok) {
        throw new Error(
          "Backend is not reachable. Please ensure the backend server is running.",
        );
      }

      const generateData = (await generateResponse.json()) as GenerateResponse;

      if (!generateData.success || !generateData.data) {
        throw new Error(generateData.error || "Failed to start generation");
      }

      setCurrentJob({
        id: generateData.data.jobId,
        assignmentId: generateData.data.assignmentId,
        status: generateData.data.status,
        steps: [
          "Analyzing input and parameters...",
          "Structuring prompt for LLM...",
          "Job queued via BullMQ...",
          "AI Agent generating questions...",
          "Finalizing formatting & rubrics...",
        ],
        currentStep: 0,
        createdAt: new Date().toISOString(),
      });

      resetCreateForm();
      router.push(
        `/generating?assignmentId=${generateData.data.assignmentId}&jobId=${generateData.data.jobId}`,
      );
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Failed to generate assignment. Please check if the backend is running.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell
      currentView="create"
      title="Assignment"
      showBack={true}
      onBack={() => router.push("/dashboard")}
    >
      <div className="flex-1 bg-[#F9FAFB] flex flex-col relative min-h-screen pb-24 lg:pb-0">
        <div className="lg:hidden flex items-center justify-center py-4  sticky top-0 z-20">
          <button
            onClick={() => router.push("/dashboard")}
            className="absolute left-4 p-2 "
          >
            <ArrowLeft size={20} className="text-gray-800" />
          </button>
          <h1 className="text-base text-xl font-bold text-gray-900">
            Create Assignment
          </h1>
        </div>
        <div className="hidden lg:flex mb-6  p-8 items-center space-x-4">
          <span className="w-3.5 h-3.5 rounded-full bg-green-500 inline-block shadow-lg  outline-4 outline-green-200" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              Create Assignment
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Set up a new assignment for your students
            </p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto   flex justify-center">
          <div className="w-full max-w-[800px]">
            <div className="relative p-1 md:p-2  rounded-2xl bg-[#F0F6FF]/30 lg:bg-transparent lg:border-none">
              <div className="bg-gray-200/30 rounded-[2rem] shadow-sm lg:shadow-md border-2 border-white p-5 lg:p-10 relative z-10 m-4">
                <div className="mb-6 lg:mb-8 border-b border-gray-100 pb-4 lg:pb-0 lg:border-none">
                  <div className="  px-3 py-1 bg-blue-50/50 rounded lg:border-none lg:bg-transparent lg:px-0 lg:py-0">
                    <h2 className="text-base lg:text-xl font-bold text-gray-900">
                      Assignment Details
                    </h2>
                  </div>
                  <p className="text-xs lg:text-sm text-gray-500 mt-1">
                    Basic information about your assignment
                  </p>
                </div>

                <div
                  className={`border-[1.5px] border-dashed rounded-2xl p-8 flex flex-col items-center justify-center mb-4 transition-colors cursor-pointer ${
                    isDragOver
                      ? "border-[#EA7A5B] bg-white"
                      : "border-gray-300 bg-white hover:bg-gray-50"
                  }`}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setIsDragOver(false);
                  }}
                  onDrop={async (event) => {
                    event.preventDefault();
                    setIsDragOver(false);

                    try {
                      await handleSelectedFile(
                        event.dataTransfer.files?.[0] ?? null,
                      );
                    } catch (fileError) {
                      setError(
                        fileError instanceof Error
                          ? fileError.message
                          : "Unable to read the selected file.",
                      );
                    }
                  }}
                >
                  <div className="w-10 h-10  rounded-full flex items-center justify-center mb-3">
                    <UploadCloud size={20} className="text-gray-600" />
                  </div>
                  <p className="text-gray-800 font-semibold mb-1 text-sm lg:text-base text-center">
                    Choose a file or drag &amp; drop it here
                  </p>
                  <p className="text-[10px] lg:text-xs text-gray-400 mb-5 uppercase tracking-wide">
                    PDF, TXT, upto 10MB
                  </p>
                  <button
                    type="button"
                    className="bg-gray-100 border border-gray-200 text-gray-700 px-5 py-1.5 rounded-full text-xs font-bold  hover:bg-gray-50 transition-colors"
                  >
                    Browse Files
                  </button>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.txt,text/plain,application/pdf"
                  className="hidden"
                  onChange={async (event) => {
                    try {
                      await handleSelectedFile(event.target.files?.[0] ?? null);
                    } catch (fileError) {
                      setError(
                        fileError instanceof Error
                          ? fileError.message
                          : "Unable to read the selected file.",
                      );
                    }
                  }}
                />
                <p className="text-center text-xs lg:text-sm text-black font-bold mb-8 lg:mb-10">
                  {createForm.fileName ||
                    "Upload images of your preferred document/image"}
                </p>

                <div className="mb-8 lg:mb-10 ">
                  <label className="block text-sm lg:text-base font-bold text-gray-800 mb-3">
                    Due Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={createForm.dueDate}
                      onChange={(event) =>
                        setCreateFormField("dueDate", event.target.value)
                      }
                      className="w-full  border border-gray-200 rounded-full px-5 py-4 text-sm text-gray-700 outline-none focus:border-gray-400 transition-colors placeholder:text-gray-400 font-medium"
                    />
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 w-8 h-8  rounded-lg border border-gray-200 flex items-center justify-center cursor-pointer  hover:bg-gray-50">
                      <Plus size={16} className="text-gray-600" />
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="hidden lg:flex items-center justify-between mb-4">
                    <label className="block text-base font-bold text-gray-800">
                      Question Type
                    </label>
                    <span className="text-sm font-bold text-gray-800">
                      {" "}
                      Difficulty
                    </span>
                    <div className="flex gap-14 text-sm font-bold text-gray-800 pr-12">
                      <span>No. of Questions</span>
                      <span>Marks</span>
                    </div>
                  </div>
                  <label className="block lg:hidden text-base font-bold text-gray-800 mb-4">
                    Question Type
                  </label>

                  <div className="space-y-4 lg:space-y-3">
                    {createForm.questionTypes.map((questionType) => (
                      <div
                        key={questionType.id}
                        className="bg-[#F9FAFB] lg:bg-transparent p-4 lg:p-0 rounded-2xl border border-gray-100 lg:border-none flex flex-col lg:flex-row lg:items-center gap-4"
                      >
                        <div className="flex items-center gap-2 lg:flex-1 relative">
                          <select
                            value={questionType.type}
                            onChange={(event) =>
                              replaceQuestionType(questionType.id, {
                                type: event.target.value,
                              })
                            }
                            className="w-full bg-white lg:bg-white rounded-full px-4 py-3.5 text-sm text-gray-800 font-semibold appearance-none outline-none pr-10"
                          >
                            {questionTypeChoices.map((choice) => (
                              <option key={choice}>{choice}</option>
                            ))}
                          </select>
                          <ChevronDown
                            size={16}
                            className="absolute right-14 lg:right-4 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"
                          />
                          {/* Mobile: X button next to question type */}
                          <button
                            onClick={() => removeQuestionType(questionType.id)}
                            className="lg:hidden text-gray-400 hover:text-red-500 p-2 shrink-0"
                            type="button"
                          >
                            <X size={18} />
                          </button>
                        </div>

                        <div className="flex lg:hidden justify-between text-l font-bold text-black px-2 mt-2">
                          <span>Difficulty</span>
                          <span>No. of Questions</span>
                          <span>Marks</span>
                        </div>

                        <div className="flex flex-row items-stretch lg:items-center justify-between lg:justify-end gap-3 lg:gap-6 flex-wrap">
                          <div className="relative ">
                            <select
                              value={questionType.difficulty}
                              onChange={(event) =>
                                replaceQuestionType(questionType.id, {
                                  difficulty: event.target
                                    .value as (typeof difficultyChoices)[number],
                                })
                              }
                              className="w-full bg-white lg:bg-white rounded-full px-4 py-3.5 text-sm text-gray-800 font-semibold appearance-none outline-none pr-10"
                            >
                              {difficultyChoices.map((choice) => (
                                <option key={choice}>{choice}</option>
                              ))}
                            </select>
                            <ChevronDown
                              size={16}
                              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"
                            />
                          </div>
                          {/* Desktop: X button after difficulty */}
                          <button
                            onClick={() => removeQuestionType(questionType.id)}
                            className="hidden lg:flex text-gray-400 hover:text-red-500 p-2"
                            type="button"
                          >
                            <X size={18} className="" />
                          </button>
                          <div className="flex items-center bg-white lg:bg-white rounded-full p-3 w-28 lg:w-28 justify-between">
                            <button
                              onClick={() =>
                                updateQuestionType(questionType.id, "count", -1)
                              }
                              className="text-gray-500 hover:text-gray-900 transition-colors px-2"
                              type="button"
                            >
                              <XIcon className="w-4 h-4" type="minus" />
                            </button>
                            <span className="font-bold text-sm text-gray-800">
                              {questionType.count}
                            </span>
                            <button
                              onClick={() =>
                                updateQuestionType(questionType.id, "count", 1)
                              }
                              className="text-gray-500 hover:text-gray-900 transition-colors px-2"
                              type="button"
                            >
                              <Plus size={16} />
                            </button>
                          </div>

                          <div className="flex items-center bg-white lg:bg-white  rounded-full p-3 w-28 lg:w-28 justify-between">
                            <button
                              onClick={() =>
                                updateQuestionType(questionType.id, "marks", -1)
                              }
                              className="text-gray-500 hover:text-gray-900 transition-colors px-2"
                              type="button"
                            >
                              <XIcon className="w-4 h-4" type="minus" />
                            </button>
                            <span className="font-bold text-sm text-gray-800">
                              {questionType.marks}
                            </span>
                            <button
                              onClick={() =>
                                updateQuestionType(questionType.id, "marks", 1)
                              }
                              className="text-gray-500 hover:text-gray-900 transition-colors px-2"
                              type="button"
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={addQuestionType}
                    className="flex items-center gap-3 mt-6 lg:mt-5 text-sm font-bold text-gray-900 hover:opacity-80 transition-opacity"
                  >
                    <div className="bg-[#1C1C1C] text-white rounded-full p-1.5">
                      <Plus size={14} strokeWidth={3} />
                    </div>
                    Add Question Type
                  </button>
                </div>

                <div className="flex flex-col items-end gap-1.5 mb-8 text-xs lg:text-sm font-bold text-gray-600">
                  <p>
                    Total Questions :{" "}
                    <span className="text-gray-900 ml-1">{totalQuestions}</span>
                  </p>
                  <p>
                    Total Marks :{" "}
                    <span className="text-gray-900 ml-1">{totalMarks}</span>
                  </p>
                </div>

                <div className="mt-8 border-t border-gray-100 pt-8">
                  <label className="block text-sm lg:text-base font-bold text-gray-800 mb-3">
                    Additional Information (For better output)
                  </label>
                  <div className="relative">
                    <textarea
                      rows={4}
                      value={createForm.additionalInfo}
                      onChange={(event) =>
                        setCreateFormField("additionalInfo", event.target.value)
                      }
                      placeholder="e.g Generate a question paper for 3 hour exam duration..."
                      className="w-full bg-[#F9FAFB] border-dashed border-2 border-gray-200 rounded-xl px-5 py-4 text-sm text-gray-700 outline-none focus:border-gray-400 transition-colors placeholder:text-gray-400 font-medium resize-none"
                    />
                    <button
                      type="button"
                      onClick={handleToggleRecording}
                      className={`absolute bottom-4 right-4 p-2.5 rounded-full transition-colors ${
                        isRecording
                          ? "bg-red-500 text-white animate-pulse"
                          : "text-black hover:bg-gray-200"
                      }`}
                      title={
                        isRecording ? "Stop recording" : "Start voice input"
                      }
                    >
                      <Mic size={16} />
                    </button>
                  </div>
                </div>

                {recognitionError ? (
                  <p className="mt-2 text-xs font-medium text-orange-600 flex items-center gap-2">
                    <Mic size={14} />
                    {recognitionError}
                  </p>
                ) : null}
                {error ? (
                  <p className="mt-4 text-sm font-medium text-red-600">
                    {error}
                  </p>
                ) : null}
              </div>
              <div className="  bottom-0 left-0 right-0   p-4 lg:py-4 lg:px-8 flex justify-between items-center z-50 lg:z-10 rounded-t-3xl lg:rounded-none">
                <button
                  onClick={() => router.push("/dashboard")}
                  className="bg-white text-gray-700 border-gray-200 py-3 px-6 rounded-full flex items-center gap-2 text-sm font-bold hover:opacity-80 transition-colors"
                  type="button"
                >
                  <ArrowLeft size={18} className="" />
                  <span className=" lg:inline">Previous</span>
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={submitting}
                  className="bg-[#1C1C1C] text-white hover:bg-black py-3 px-8 rounded-full flex items-center gap-2 text-sm font-bold transition-all shadow-sm disabled:opacity-70"
                  type="button"
                >
                  Next
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
