import { Request, Response } from 'express'

import db from '../database/connection'
import convertTime from '../util/convertHoursToMinutes'

interface scheduleItem {
    week_day: number,
    from: string,
    to: string
}

export default class ClassesController {
    async index(req: Request, res: Response){
        const filter = req.query

        const subject = filter.subject as string
        const week_day = filter.week_day as string
        const time = filter.time as string

        if(!filter.subject || !filter.week_day || !filter.time){
            return res.status(400).json({
                error: "Missing filters to search classes."
            })
        }

        const timeInMinutes = convertTime(filter.time as string)

        const classes = await db('classes')
            .whereExists(function(){
                this.select('class_schedule.*')
                    .from('class_schedule')
                    .whereRaw('`class_schedule`.`class_id` = `classes`.`id`')
                    .whereRaw('`class_schedule`.`week_day` = ??', [Number(week_day)])
                    .whereRaw('`class_schedule`.`from` <= ??', [timeInMinutes])
                    .whereRaw('`class_schedule`.`to` > ??', [timeInMinutes])
            })
            .where('classes.subject', '=', subject)
            .join('users', 'classes.user_id', '=', 'users.id')
            .select(['classes.*', 'users.*'])

        return res.json(classes)
    }

    async create(req: Request, res: Response) {
        const {
            name,
            avatar,
            whatsapp,
            bio,
            subject,
            cost,
            schedule
        } = req.body
    
        const trx = await db.transaction()
        try {
    
    
            const insertedUserIds = await trx('users').insert({
                name,
                avatar,
                whatsapp,
                bio
            })
    
            const user_id = insertedUserIds[0]
    
            const insertedClassesIds = await trx('classes').insert({
                subject,
                cost,
                user_id
            })
    
            const class_id = insertedClassesIds[0]
    
            const classSchedule = schedule.map((scheduleItem: scheduleItem) => {
                return {
                    class_id,
                    week_day: scheduleItem.week_day,
                    from: convertTime(scheduleItem.from),
                    to: convertTime(scheduleItem.to)
                };
            })
    
            await trx('class_schedule').insert(classSchedule)
    
            await trx.commit()
    
            return res.status(201).send()
        } catch (error) {
            console.log(error)
            await trx.rollback()
    
            return res.status(400).json({
                error: "Unexpected error while creating new class."
            })
        }
    }
}