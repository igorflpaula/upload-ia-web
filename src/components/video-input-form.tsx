import { Download, FileVideo, Upload } from "lucide-react";
import { Separator } from "./ui/separator";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { getFFmpeg } from "@/lib/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { api } from "@/lib/axios";

type Status = 'waiting' | 'converting' | 'uploading' | 'transcribing' | 'generating' | 'success'

const statusMessages = {
    converting: 'Convertendo..',
    transcribing: 'Transcrevendo..',
    generating: 'Gerando..',
    uploading: 'Carregando..',
    success: 'Concluído!'
}

interface VideoInputFormProps {
    onVideoUploaded: (id: string) => void
}

export function VideoInputForm(props: VideoInputFormProps) {
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [status, setStatus] = useState<Status>('waiting')
    const promptInputRef = useRef<HTMLTextAreaElement>(null)

    function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
        const { files } = event.currentTarget

        if (!files) { return }

        const selectedFile = files[0]

        setVideoFile(selectedFile)
    }

    async function convertVideoToAudio(video: File) {
        console.log('Convert started')

        const ffmpeg = await getFFmpeg()

        await ffmpeg.writeFile('input.mp4', await fetchFile(video))

        // DESCOMENTAR CASO ESTEJA DANDO ALGUM BUG
        // ffmpeg.on('log', log => {
        //     console.log(log)
        // })

        ffmpeg.on('progress', progress => {
            console.log('Convert progress: ' + Math.round(progress.progress * 100))
        })

        await ffmpeg.exec([
            '-i',
            'input.mp4',
            '-map',
            '0:a',
            '-b:a',
            '20k',
            '-acodec',
            'libmp3lame',
            'output.mp3'
        ])

        const data = await ffmpeg.readFile('output.mp3')

        const audioFileBlob = new Blob([data], { type: 'audio/mpeg' })
        const audioFile = new File([audioFileBlob], 'audio.mp3', {
            type: 'audio/mpeg'
        })

        console.log('Convert Finished')

        return audioFile
    }

    async function handleUploadVideo(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()

        const prompt = promptInputRef.current?.value

        if (!videoFile) { return }

        // CONVERTER O VÍDEO EM ÁUDIO
        setStatus('converting')
        const audioFile = await convertVideoToAudio(videoFile)
        const data = new FormData()

        data.append('file', audioFile)

        setStatus('uploading')
        const response = await api.post('/videos', data)
        const videoId = response.data.video.id

        // Idealmente, a função de Upload para aqui
        // A transcrição fica em outra função, porque ela se torna Opcional
        // Somente quando o usuário quer utilizar a transcrição no Chat GPT 

        // GERAR TRANSCRIÇÃO
        // COMENTADO TEMPORARIAMENTE
        // setStatus('transcribing')
        // await api.post(`/videos/${videoId}/transcription`, { prompt })


        // GERAR LEGENDA
        // MOVER PARA OUTRA FUNÇÃO POSTERIORMENTE
        setStatus('generating')
        await api.post(`/videos/${videoId}/subtitle`, { prompt })

        setStatus('success')
        props.onVideoUploaded(videoId) //  props.onVideoUploaded(String(videoId))
    }

    // TO DO - Perdido de como seguir aqui
    async function handleDownloadSrt(){
        const videoId = 'iuehuie';

        setStatus('generating')
        await api.post(`/videos/${videoId}/subtitle`, { prompt })
        setStatus('success')
    }

    const previewURL = useMemo(() => {
        if (!videoFile) { return }

        return URL.createObjectURL(videoFile)
    }, [videoFile])

    return (
        <form onSubmit={handleUploadVideo} className='space-y-6'>
            <label
                htmlFor="video"
                className='relative border flex rounded-md aspect-video cursor-pointer border-dashed text-sm flex-col gap-2 items-center justify-center text-muted-foreground hover:bg-primary/20'
            >
                {previewURL ? (
                    <video src={previewURL} controls={false} className="pointer-events-none absolute inset-0" />
                ) : (
                    <>
                        <FileVideo className='w-6 h-6' />
                        Selecione um vídeo
                    </>
                )}
            </label>
            <input type="file" id='video' accept='video/mp4' className='sr-only' onChange={handleFileSelected} />
            <Separator />

            <div className='space-y-2'>
                <Label htmlFor='transcription_prompt'>Prompt de transcrição</Label>
                <Textarea
                    ref={promptInputRef}
                    disabled={status != 'waiting'}
                    id='transcription_prompt'
                    className='h-20 leading-relaxed resize-none text-xs'
                    placeholder="Para legendas menores adicione 'max_line_length', seguindo da quantidade de caracteres. Ex.: max_line_length: 42"
                />
                {/* Inclua palavras-chave mencionadas no vídeo separadas por vírgula */}
            </div>

            <div className="flex gap-4 w-full">
                <Button
                    data-success={status === 'success'}
                    disabled={status != 'waiting'}
                    type='submit'
                    className='data-[success=true]:bg-emerald-400 text-xs w-full'
                >
                    {status === 'waiting' ? (
                        <>
                            Carregar vídeo
                            <Upload className="w-4 h-4 ml-2" />
                        </>
                    ) : statusMessages[status]}
                </Button>
                <Button
                    className='data-[success=true]:bg-emerald-400 text-xs w-full'
                    disabled
                    onClick={handleDownloadSrt}
                >
                    <>
                        Download .srt
                        <Download className="w-4 h-4 ml-2" />
                    </>
                </Button>
            </div>

        </form>
    )
}