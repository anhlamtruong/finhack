"use client";

import { useState, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { useNewTransaction } from "@/services/transactions/hooks/use-new-transaction";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function VoiceTransactionButton() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const trpc = useTRPC();
  const { openWithValues } = useNewTransaction();

  const parseVoiceMutation = useMutation(
    trpc.parseVoice.mutationOptions({
      onSuccess: (data) => {
        const preview =
          data.transcription.length > 50
            ? `${data.transcription.slice(0, 50)}...`
            : data.transcription;
        toast.success(`Parsed: "${preview}"`);

        // Open transaction form with prefilled values
        openWithValues({
          amount: data.amount,
          payee: data.payee,
          category: data.category,
          date: data.date,
          notes: data.notes,
        });
      },
      onError: (error) => {
        toast.error(`Failed to parse voice: ${error.message}`);
      },
    }),
  );

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Check for supported mime types
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "audio/ogg";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      setRecordingDuration(0);

      // Start duration timer
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Clear timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        const audioBlob = new Blob(chunksRef.current, { type: mimeType });

        // Check minimum duration (at least 0.5 seconds)
        if (audioBlob.size < 1000) {
          toast.error("Recording too short. Please try again.");
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        // Convert to base64
        const arrayBuffer = await audioBlob.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            "",
          ),
        );

        toast.info("Processing your voice recording...");

        // Send to tRPC
        parseVoiceMutation.mutate({
          audioBase64: base64,
          mimeType,
        });

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info("Recording... Speak your transaction");
    } catch (error) {
      console.error("Microphone access error:", error);
      toast.error("Could not access microphone. Please check permissions.");
    }
  }, [parseVoiceMutation]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingDuration(0);
    }
  }, [isRecording]);

  const isProcessing = parseVoiceMutation.isPending;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={isRecording ? "destructive" : "outline"}
          size="sm"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          className="relative"
        >
          {isProcessing ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : isRecording ? (
            <>
              <MicOff className="size-4 mr-2" />
              Stop ({formatDuration(recordingDuration)})
            </>
          ) : (
            <>
              <Mic className="size-4 mr-2" />
              Voice
            </>
          )}
          {isRecording && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {isRecording
            ? "Click to stop recording"
            : isProcessing
              ? "Processing your voice..."
              : "Record a voice transaction (e.g., 'Spent $25 at Starbucks for coffee')"}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
