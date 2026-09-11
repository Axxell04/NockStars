import { env } from "$env/dynamic/private";
import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import nodemailer from 'nodemailer';
import { getContacts } from "$lib/server/contact";

export const load: PageServerLoad = async () => {
    const contacts = await getContacts();

    return {
        contacts: contacts,
        seo: {
            title: 'Contacto — NockStars',
            description: '¿Tenés una consulta o querés hacer un pedido especial? Contactanos por WhatsApp, Instagram o email.',
            type: 'website'
        }
    }
}

export const actions: Actions = {
    send_message: async (event) => {
        const formData = await event.request.formData();
        const from = formData.get('from') as string;
        const message = formData.get('message') as string;

        if (!env.MAIL_USER || !env.MAIL_PASS || !env.MAIL_TO || !from || !message) {
            return fail(500, { message: 'No se pudo realizar el envío' })
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: env.MAIL_USER,
                pass: env.MAIL_PASS
            }
        });

        const mailOptions = {
            from: env.MAIL_USER,
            to: env.MAIL_TO,
            subject: `Murci | ${from}`,
            text: message,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log("Error al enviar el correo: ",error)
            } else {
                console.log("Correo enviado con éxito: ", info.response)
            }
        })

    }
}